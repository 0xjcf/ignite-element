import { type IgniteAdapter, StateScope } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { createMachine } from "xstate";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import { requireBindingStore } from "../runtime/bindings";
import { createLifetime } from "../runtime/lifetime";
import { igniteCore } from "../xstate";

describe("terminal core lifetime", () => {
	it.each(["watch", "on", "execute"] as const)(
		"rolls back newly acquired resources when %s subscription setup fails",
		async (mode) => {
			const failure = { reason: "subscribe" };
			const stop = vi.fn();
			let fail = true;
			const subscribe = () => {
				if (fail) throw failure;
				return { unsubscribe() {} };
			};
			const create = vi.fn(() => ({
				scope: StateScope.Isolated,
				getSnapshot: () => ({ count: 0 }),
				subscribeSnapshots: subscribe,
				subscribeEvents: subscribe,
				send() {},
				stop,
			}));
			const factory = Object.assign(create, {
				scope: StateScope.Isolated,
				resolveStateSnapshot: (
					adapter: IgniteAdapter<{ count: number }, { type: "INC" }>,
				) => adapter.getSnapshot(),
				resolveCommandActor: () => ({}),
			});
			const core = createIgniteComponentFactory(factory, {
				states: (snapshot) => snapshot,
				commands: () => ({ run() {} }),
				events: (event) => ({ changed: event<{ count: number }>() }),
			});
			const acquire = () =>
				mode === "watch"
					? core.watch(() => {})
					: mode === "on"
						? core.on("changed", () => {})
						: core.execute({ command: "run" });
			try {
				await acquire();
				throw Error("expected setup failure");
			} catch (error) {
				expect(error).toBe(failure);
			}
			expect(stop).toHaveBeenCalledOnce();
			fail = false;
			const handle = await acquire();
			expect(create).toHaveBeenCalledTimes(2);
			if ("unsubscribe" in handle) handle.unsubscribe();
			core.dispose();
			expect(stop).toHaveBeenCalledTimes(2);
		},
	);
	it("invalidates late source callbacks before owned cleanup and never reacquires", () => {
		const callbacks: Array<(value: { count: number }) => void> = [];
		const release = vi.fn();
		const create = vi.fn(() => ({
			scope: StateScope.Shared,
			getSnapshot: () => ({ count: 0 }),
			subscribeSnapshots: (callback: (value: { count: number }) => void) => {
				callbacks.push(callback);
				return {
					unsubscribe: () => {
						release();
						callback({ count: 999 });
					},
				};
			},
			send() {},
			stop() {},
		}));
		const factory = Object.assign(create, {
			scope: StateScope.Shared,
			resolveStateSnapshot: (
				adapter: IgniteAdapter<{ count: number }, { type: "INC" }>,
			) => adapter.getSnapshot(),
			resolveCommandActor: () => ({}),
		});
		const core = createIgniteComponentFactory(factory, {
			states: (snapshot) => snapshot,
		});
		core.get("states");
		const framework = vi.fn(),
			watched = vi.fn();
		const releaseFramework = requireBindingStore(core).subscribe(framework);
		const handle = core.watch(watched);
		core.dispose();
		for (const callback of callbacks) callback({ count: 42 });
		expect(framework).not.toHaveBeenCalled();
		expect(watched).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledOnce();
		const releases = release.mock.calls.length;
		releaseFramework();
		handle.unsubscribe();
		core.dispose();
		expect(release).toHaveBeenCalledTimes(releases);
	});
	it("rolls back failed framework preparation and retries with fresh owned resources", () => {
		const failure = { reason: "preparation" };
		const stops: ReturnType<typeof vi.fn>[] = [];
		let fail = true;
		let stateReads = 0;
		const factory = Object.assign(
			() => {
				const stop = vi.fn();
				stops.push(stop);
				return {
					scope: StateScope.Isolated,
					getSnapshot: () => ({ count: 0 }),
					subscribeSnapshots: () => ({ unsubscribe() {} }),
					send() {},
					stop,
				};
			},
			{
				scope: StateScope.Isolated,
				resolveStateSnapshot: (
					adapter: IgniteAdapter<{ count: number }, { type: "INC" }>,
				) => adapter.getSnapshot(),
				resolveCommandActor: () => ({}),
			},
		);
		const core = createIgniteComponentFactory(factory, {
			states: (snapshot) => {
				if (fail && ++stateReads > 1) throw failure;
				return snapshot;
			},
			commands: () => ({ run() {} }),
		});
		try {
			core.get("states");
			throw Error("expected preparation failure");
		} catch (error) {
			expect(error).toBe(failure);
		}
		expect(stops).toHaveLength(1);
		expect(stops[0]).toHaveBeenCalledOnce();
		fail = false;
		expect(core.get("states")).toEqual({ count: 0 });
		expect(stops).toHaveLength(2);
		core.dispose();
		expect(stops[0]).toHaveBeenCalledOnce();
		expect(stops[1]).toHaveBeenCalledOnce();
	});
	it.each([undefined, null, { reason: "first" }])(
		"drains every release and preserves the first exact thrown value: %s",
		(reason) => {
			const life = createLifetime();
			const calls: string[] = [];
			const first = life.own(() => {
				calls.push("first");
				expect(life.active).toBe(false);
				throw reason;
			});
			const second = life.own(() => {
				calls.push("second");
				first();
				life.dispose();
				throw new Error("secondary");
			});
			let thrown = false;
			try {
				life.dispose(() => calls.push("native"));
			} catch (error) {
				thrown = true;
				expect(error).toBe(reason);
			}
			expect(thrown).toBe(true);
			expect(calls).toEqual(["first", "second", "native"]);
			first();
			second();
			life.dispose();
			expect(calls).toEqual(["first", "second", "native"]);
			expect(() => life.assertActive()).toThrow(/disposed/);
		},
	);

	it("rolls back a late acquired release exactly once", () => {
		const life = createLifetime();
		life.dispose();
		const cleanup = vi.fn();
		expect(() => life.own(cleanup)).toThrow(/disposed/);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("retains direct pending promise identity but rejects fulfilled execute after disposal", async () => {
		let resolve: (value: number) => void = () => {
			throw Error("not initialized");
		};
		const pending = new Promise<number>((done) => {
			resolve = done;
		});
		const core = igniteCore({
			source: createMachine({}),
			commands: () => ({ run: () => pending }),
		});
		core.get("states");
		const run = requireBindingStore(core).read().run;
		if (typeof run !== "function") throw Error("missing command");
		const direct = run();
		expect(direct).toBe(pending);
		const execution = core.execute({ command: "run" });
		const result = expect(execution).rejects.toThrow(/disposed/);
		core.dispose();
		resolve(17);
		expect(await direct).toBe(17);
		await result;
		expect(() => run()).toThrow(/disposed/);
	});

	it.each([undefined, null, { reason: "command" }])(
		"preserves pending execute rejection after disposal: %s",
		async (reason) => {
			let reject: (reason: unknown) => void = () => {
				throw Error("not initialized");
			};
			const pending = new Promise<void>((_resolve, fail) => {
				reject = fail;
			});
			const core = igniteCore({
				source: createMachine({}),
				commands: () => ({ run: () => pending }),
			});
			const execution = core.execute({ command: "run" });
			const result = execution.then(
				() => {
					throw Error("unexpected fulfillment");
				},
				(error) => expect(error).toBe(reason),
			);
			core.dispose();
			reject(reason);
			await result;
		},
	);

	it("passes one payload argument, without spreading an array", async () => {
		const calls: unknown[][] = [];
		const core = igniteCore({
			source: createMachine({}),
			commands: () => ({
				run(input?: number[]) {
					calls.push([input, arguments.length]);
				},
			}),
		});
		await core.execute({ command: "run", input: [1, 2] });
		await core.execute({ command: "run" });
		expect(calls).toEqual([
			[[1, 2], 1],
			[undefined, 1],
		]);
		core.dispose();
	});
});
