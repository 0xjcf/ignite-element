// @vitest-environment node

import {
	type DevtoolsCommandRecord,
	type DevtoolsEventRecord,
	installDevtoolsHook,
} from "ignite-element/devtools-hook";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, emit, setup } from "xstate";
import { requireBindingStore } from "../runtime/bindings";
import {
	devtoolsDelivery,
	resetDevtoolsHookForTests,
} from "../runtime/devtoolsHook";
import { defineToolSchema, igniteTools } from "../tools";
import { igniteCore } from "../xstate";

afterEach(() => {
	resetDevtoolsHookForTests();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

function createCore() {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INC" } | { type: "RESET" },
			emitted: {} as { type: "counterReset"; count: number },
		},
	}).createMachine({
		context: { count: 0 },
		initial: "active",
		states: {
			active: {
				on: {
					INC: {
						actions: assign({
							count: ({ context }) => context.count + 1,
						}),
					},
					RESET: {
						actions: [
							assign({ count: 0 }),
							emit({ type: "counterReset", count: 0 }),
						],
					},
				},
			},
		},
	});
	return igniteCore({
		source: machine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source }) => ({
			increment: () => source.send({ type: "INC" }),
			reset: () => source.send({ type: "RESET" }),
		}),
		events: (event) => ({
			countChanged: event<{ count: number }>(),
			counterReset: event<{ count: number }>(),
		}),
		effects: ({ emit: emitEffect, select }) => {
			const count = select((state) => state.context.count);
			if (count.changed) {
				emitEffect({ type: "countChanged", count: count.current });
			}
		},
	});
}

describe("installDevtoolsHook", () => {
	it("receives native and effect events with their origin", async () => {
		const records: DevtoolsEventRecord[] = [];
		const uninstall = installDevtoolsHook({
			event: (record) => {
				records.push(record);
			},
		});
		const core = createCore();
		core.on("counterReset", () => {});
		const started = Date.now();
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		const finished = Date.now();

		const effect = records.find((record) => record.type === "countChanged");
		const native = records.find((record) => record.type === "counterReset");
		expect(effect).toMatchObject({
			origin: "effect",
			payload: { count: 1 },
		});
		expect(native).toMatchObject({
			origin: "native",
			payload: { count: 0 },
		});
		expect(effect?.coreId).toBe(native?.coreId);
		expect(effect?.coreId).toMatch(/^devtools-core-\d+$/);
		expect(effect?.at).toBeGreaterThanOrEqual(started);
		expect(native?.at).toBeLessThanOrEqual(finished);
		expect(effect?.at).toBeTypeOf("number");

		const delivered = records.length;
		uninstall();
		await core.execute({ command: "increment" });
		expect(records).toHaveLength(delivered);
		core.dispose();
	});

	it("does not call or allocate the publisher when no hook is installed", async () => {
		const publish = vi.spyOn(devtoolsDelivery, "publish");
		const core = createCore();
		core.on("counterReset", () => {});
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		expect(publish).not.toHaveBeenCalled();
		expect(devtoolsDelivery.hook).toBeUndefined();
		core.dispose();
	});

	it("is a no-op in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const publish = vi.spyOn(devtoolsDelivery, "publish");
		const publishCommand = vi.spyOn(devtoolsDelivery, "publishCommand");
		const hook = vi.fn();
		const command = vi.fn();
		const uninstall = installDevtoolsHook({ event: hook, command });
		const core = createCore();
		core.on("counterReset", () => {});
		core.get("states");
		const increment = requireBindingStore(core).read().increment;
		if (typeof increment !== "function") throw new Error("missing command");
		increment();
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		expect(hook).not.toHaveBeenCalled();
		expect(command).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
		expect(publishCommand).not.toHaveBeenCalled();
		expect(devtoolsDelivery.hook).toBeUndefined();
		uninstall();
		core.dispose();
	});

	it("does not publish native events the runtime does not deliver", async () => {
		const records: DevtoolsEventRecord[] = [];
		installDevtoolsHook({
			event: (record) => {
				records.push(record);
			},
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" } | { type: "RESET" },
				emitted: {} as
					| { type: "counterReset"; count: number }
					| { type: "ignoredTick" },
			},
		}).createMachine({
			context: { count: 0 },
			initial: "active",
			states: {
				active: {
					on: {
						INC: {
							actions: emit({ type: "ignoredTick" }),
						},
						RESET: {
							actions: emit({ type: "counterReset", count: 0 }),
						},
					},
				},
			},
		});
		const core = igniteCore({
			source: machine,
			states: () => ({ ready: true }),
			commands: ({ source }) => ({
				increment: () => source.send({ type: "INC" }),
				reset: () => source.send({ type: "RESET" }),
			}),
			events: (event) => ({
				counterReset: event<{ count: number }>(),
			}),
		});
		core.on("counterReset", () => {});
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		expect(records.map((record) => record.type)).toEqual(["counterReset"]);
		expect(records[0]).toMatchObject({ origin: "native" });
		core.dispose();
	});

	it("does not restore a hook whose uninstall already ran", async () => {
		const first: DevtoolsEventRecord[] = [];
		const second: DevtoolsEventRecord[] = [];
		const uninstallFirst = installDevtoolsHook({
			event: (record) => {
				first.push(record);
			},
		});
		const uninstallSecond = installDevtoolsHook({
			event: (record) => {
				second.push(record);
			},
		});
		const core = createCore();
		core.on("counterReset", () => {});
		uninstallFirst();
		await core.execute({ command: "reset" });
		expect(first).toHaveLength(0);
		expect(second.map((record) => record.type)).toContain("counterReset");
		const delivered = second.length;
		uninstallSecond();
		await core.execute({ command: "reset" });
		expect(first).toHaveLength(0);
		expect(second).toHaveLength(delivered);
		expect(devtoolsDelivery.hook).toBeUndefined();
		core.dispose();
	});

	it("restores the earlier hook when the later uninstall runs first", async () => {
		const first: DevtoolsEventRecord[] = [];
		const second: DevtoolsEventRecord[] = [];
		const uninstallFirst = installDevtoolsHook({
			event: (record) => {
				first.push(record);
			},
		});
		const uninstallSecond = installDevtoolsHook({
			event: (record) => {
				second.push(record);
			},
		});
		const core = createCore();
		core.on("counterReset", () => {});
		uninstallSecond();
		await core.execute({ command: "reset" });
		expect(second).toHaveLength(0);
		expect(first.map((record) => record.type)).toContain("counterReset");
		const delivered = first.length;
		uninstallFirst();
		await core.execute({ command: "reset" });
		expect(first).toHaveLength(delivered);
		expect(second).toHaveLength(0);
		expect(devtoolsDelivery.hook).toBeUndefined();
		core.dispose();
	});

	it("does not let a throwing hook interrupt delivery", async () => {
		installDevtoolsHook({
			event: () => {
				throw new Error("devtools failed");
			},
		});
		const core = createCore();
		const seen: unknown[] = [];
		core.on("countChanged", (event) => {
			seen.push(event);
		});
		await expect(
			core.execute({ command: "increment" }),
		).resolves.toBeUndefined();
		expect(seen).toEqual([{ type: "countChanged", count: 1 }]);
		core.dispose();
	});

	it("reports view and execute commands without changing their results", async () => {
		const records: DevtoolsCommandRecord[] = [];
		const uninstall = installDevtoolsHook({
			command: (record) => {
				records.push(record);
			},
		});
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: (amount: number) => {
					source.send({ type: "INC" });
					return amount;
				},
				slow: async (amount: number) => {
					await gate;
					return amount;
				},
				fail: () => {
					throw new Error("nope");
				},
			}),
		});
		core.get("states");
		const view = requireBindingStore(core).read();
		const add = view.add;
		const slow = view.slow;
		const fail = view.fail;
		if (
			typeof add !== "function" ||
			typeof slow !== "function" ||
			typeof fail !== "function"
		) {
			throw new Error("missing command");
		}

		expect(add(2)).toBe(2);
		const pending = core.execute({ command: "slow", input: 1 });
		await Promise.resolve();
		expect(add(3)).toBe(3);
		release();
		await expect(pending).resolves.toBe(1);
		await expect(core.execute({ command: "add", input: 5 })).resolves.toBe(5);
		expect(() => fail()).toThrow("nope");
		await expect(core.execute({ command: "fail" })).rejects.toThrow("nope");

		expect(records.map((record) => record.origin)).toEqual([
			"view",
			"view",
			"execute",
			"execute",
			"view",
			"execute",
		]);
		expect(records.map((record) => record.command)).toEqual([
			"add",
			"add",
			"slow",
			"add",
			"fail",
			"fail",
		]);
		expect(records[0]).toMatchObject({
			input: 2,
			outcome: 2,
			origin: "view",
		});
		expect(records[1]).toMatchObject({ input: 3, origin: "view" });
		expect(records[2]).toMatchObject({
			command: "slow",
			input: 1,
			outcome: 1,
			origin: "execute",
		});
		expect(records[3]).toMatchObject({
			command: "add",
			input: 5,
			outcome: 5,
			origin: "execute",
		});
		expect(records[4]?.outcome).toMatchObject({ message: "nope" });
		expect(records[5]?.outcome).toMatchObject({ message: "nope" });
		expect(new Set(records.map((record) => record.coreId)).size).toBe(1);
		expect(records[0]?.coreId).toMatch(/^devtools-core-\d+$/);
		for (const record of records) {
			expect(record.durationMs).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(record.durationMs)).toBe(true);
		}

		const delivered = records.length;
		uninstall();
		expect(add(1)).toBe(1);
		expect(records).toHaveLength(delivered);
		core.dispose();
	});

	it("reports an igniteTools command as tools", async () => {
		const records: DevtoolsCommandRecord[] = [];
		installDevtoolsHook({
			command: (record) => {
				records.push(record);
			},
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: (amount: number) => {
					source.send({ type: "INC" });
					return amount;
				},
			}),
		});
		const tools = igniteTools({
			core,
			schema: defineToolSchema({
				add: {
					description: "Add to the counter.",
					input: { type: "number" },
				},
			}),
		});
		const result = await tools.run({ name: "add", input: 7 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.result).toBe(7);
		expect(records).toEqual([
			expect.objectContaining({
				command: "add",
				input: 7,
				origin: "tools",
				outcome: 7,
			}),
		]);
		core.dispose();
	});

	it("does not let a throwing command hook change the result", async () => {
		installDevtoolsHook({
			command: () => {
				throw new Error("devtools failed");
			},
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: (amount: number) => {
					source.send({ type: "INC" });
					return amount;
				},
			}),
		});
		core.get("states");
		const add = requireBindingStore(core).read().add;
		if (typeof add !== "function") throw new Error("missing command");
		expect(add(4)).toBe(4);
		await expect(core.execute({ command: "add", input: 6 })).resolves.toBe(6);
		expect(core.get("states")).toEqual({ count: 2 });
		core.dispose();
	});

	it("records every argument of a view call", () => {
		const records: DevtoolsCommandRecord[] = [];
		installDevtoolsHook({
			command: (record) => {
				records.push(record);
			},
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({ context: { count: 0 } });
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: () => ({
				tuple: (left: number, right: number) => left + right,
			}),
		});
		core.get("states");
		const tuple = requireBindingStore(core).read().tuple;
		if (typeof tuple !== "function") throw new Error("missing command");
		expect(tuple(2, 3)).toBe(5);
		expect(records).toEqual([
			expect.objectContaining({
				command: "tuple",
				input: [2, 3],
				origin: "view",
				outcome: 5,
			}),
		]);
		expect(Object.isFrozen(records[0]?.input)).toBe(true);
		core.dispose();
	});

	it("returns a thenable unchanged when settlement cannot be observed", () => {
		const records: DevtoolsCommandRecord[] = [];
		installDevtoolsHook({
			command: (record) => {
				records.push(record);
			},
		});
		const attachFails = {
			// biome-ignore lint/suspicious/noThenProperty: the tap must tolerate a thenable whose then() throws.
			then() {
				throw new Error("attach");
			},
		};
		const inspectFails = {};
		Object.defineProperty(
			inspectFails,
			// biome-ignore lint/suspicious/noThenProperty: the tap must tolerate a throwing then getter.
			"then",
			{
				get() {
					throw new Error("inspect");
				},
			},
		);
		class BrokenPromise extends Promise<string> {
			// biome-ignore lint/suspicious/noThenProperty: the tap must tolerate a Promise subclass whose then() throws.
			override then<TResult1 = string, TResult2 = never>(
				_onfulfilled?:
					| ((value: string) => TResult1 | PromiseLike<TResult1>)
					| null,
				_onrejected?:
					| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
					| null,
			): Promise<TResult1 | TResult2> {
				throw new Error("derived");
			}
		}
		const derived = new BrokenPromise((resolve) => {
			resolve("ok");
		});
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({ context: { count: 0 } });
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: () => ({
				attach: () => attachFails,
				inspect: () => inspectFails,
				derived: () => derived,
			}),
		});
		core.get("states");
		const view = requireBindingStore(core).read();
		expect(view.attach).toBeTypeOf("function");
		expect(view.inspect).toBeTypeOf("function");
		expect(view.derived).toBeTypeOf("function");
		const attach = view.attach as () => unknown;
		const inspect = view.inspect as () => unknown;
		const derivedCommand = view.derived as () => unknown;
		expect(attach()).toBe(attachFails);
		expect(inspect()).toBe(inspectFails);
		expect(derivedCommand()).toBe(derived);
		expect(records.map((record) => record.command)).toEqual([
			"attach",
			"inspect",
			"derived",
		]);
		expect(records[0]?.outcome).toBe(attachFails);
		expect(records[1]?.outcome).toBe(inspectFails);
		expect(records[2]?.outcome).toBe(derived);
		core.dispose();
	});

	it("reads execute input before the origin mark and clears an unused mark", async () => {
		const records: DevtoolsCommandRecord[] = [];
		const hook: { command?: (record: DevtoolsCommandRecord) => void } = {};
		installDevtoolsHook(hook);
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: (amount: number) => {
					source.send({ type: "INC" });
					return amount;
				},
				fail: () => {
					throw new Error("nope");
				},
			}),
		});
		core.get("states");
		const add = requireBindingStore(core).read().add;
		if (typeof add !== "function") throw new Error("missing command");

		hook.command = (record) => {
			records.push(record);
		};
		await expect(
			core.execute({
				command: "add",
				get input() {
					expect(add(9)).toBe(9);
					return 4;
				},
			}),
		).resolves.toBe(4);
		expect(records.map((record) => record.origin)).toEqual(["view", "execute"]);
		expect(records.map((record) => record.input)).toEqual([9, 4]);

		await expect(
			core.execute({
				command: "add",
				get input(): number {
					throw new Error("bad input");
				},
			}),
		).rejects.toThrow("bad input");
		expect(add(1)).toBe(1);
		expect(records[records.length - 1]).toMatchObject({
			input: 1,
			origin: "view",
		});

		delete hook.command;
		await expect(core.execute({ command: "fail" })).rejects.toThrow("nope");
		await core.execute({ command: "add", input: 2 });
		hook.command = (record) => {
			records.push(record);
		};
		expect(add(3)).toBe(3);
		expect(records[records.length - 1]).toMatchObject({
			input: 3,
			origin: "view",
		});
		core.dispose();
	});

	it("does not let a throwing command property block the command", async () => {
		const hook = {};
		Object.defineProperty(hook, "command", {
			get() {
				throw new Error("hook command");
			},
		});
		installDevtoolsHook(hook);
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: (amount: number) => {
					source.send({ type: "INC" });
					return amount;
				},
			}),
		});
		core.get("states");
		const add = requireBindingStore(core).read().add;
		if (typeof add !== "function") throw new Error("missing command");
		expect(add(4)).toBe(4);
		await expect(core.execute({ command: "add", input: 6 })).resolves.toBe(6);
		expect(core.get("states")).toEqual({ count: 2 });
		core.dispose();
	});

	it("does not allocate an extra command proxy when no command hook is installed", () => {
		const countProxies = (run: () => void) => {
			const RealProxy = globalThis.Proxy;
			let created = 0;
			globalThis.Proxy = new RealProxy(RealProxy, {
				construct(target, args, newTarget) {
					created += 1;
					return Reflect.construct(target, args, newTarget);
				},
			});
			try {
				run();
			} finally {
				globalThis.Proxy = RealProxy;
			}
			return created;
		};
		const build = () => {
			const core = createCore();
			core.get("states");
			requireBindingStore(core).read();
			core.dispose();
		};
		vi.stubEnv("NODE_ENV", "production");
		const production = countProxies(build);
		vi.stubEnv("NODE_ENV", "development");
		const withoutHook = countProxies(build);
		installDevtoolsHook({
			event() {},
		});
		const withoutCommand = countProxies(build);
		resetDevtoolsHookForTests();
		installDevtoolsHook({
			command() {},
		});
		const withCommand = countProxies(build);
		expect(withoutHook).toBe(production);
		expect(withoutCommand).toBe(production);
		expect(withCommand).toBe(production);
	});
});
