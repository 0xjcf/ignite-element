import { igniteCore as actorCore } from "ignite-element/actor-web";
import { igniteCore as webCore } from "ignite-element/actor-web/web";
import { igniteCore as xstateCore } from "ignite-element/xstate";
import { describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine } from "xstate";

const machine = createMachine({
	context: { count: 0 },
	on: {
		ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});

function sourceFixture() {
	let count = 0;
	const snapshot = () => ({
		address: "recovery",
		context: { count },
		phase: "active",
		toJSON: () => ({ count }),
	});
	const listeners = new Set<(value: ReturnType<typeof snapshot>) => void>();
	const close = vi.fn();
	const source = {
		address: "recovery",
		snapshot,
		close,
		subscribe(listener: (value: ReturnType<typeof snapshot>) => void) {
			listeners.add(listener);
			listener(snapshot());
			return () => listeners.delete(listener);
		},
		send() {
			count++;
			for (const listener of listeners) listener(snapshot());
			return Promise.resolve();
		},
	};
	return { source, listeners, close };
}

describe("recoverable core setup", () => {
	it("preserves the primary setup error and rejects late callbacks from a released shared observation", async () => {
		const { source, listeners } = sourceFixture();
		const oldCallbacks: Parameters<typeof source.subscribe>[0][] = [];
		const release = vi.fn();
		let fail = true;
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const construct = () =>
			actorCore({
				source: {
					...source,
					subscribe(listener: Parameters<typeof source.subscribe>[0]) {
						oldCallbacks.push(listener);
						const off = source.subscribe(listener);
						return () => {
							off();
							release();
							if (fail) throw Error("cleanup");
						};
					},
					subscribeTransportStatus() {
						if (fail) throw null;
						return () => {};
					},
				},
				states: (s) => ({ count: s.context.count }),
				commands: ({ source: actor }) => ({
					add: () => actor.send({ type: "add" }),
				}),
			});
		try {
			construct();
			throw Error("expected failure");
		} catch (error) {
			expect(error).toBe(null);
		}
		expect(listeners.size).toBe(0);
		expect(release).toHaveBeenCalledOnce();
		fail = false;
		const core = construct();
		const seen = vi.fn();
		const handle = core.watch(seen);
		core.get("states");
		oldCallbacks[0]({ ...source.snapshot(), context: { count: 999 } });
		expect(seen).not.toHaveBeenCalled();
		await core.execute({ command: "add" });
		expect(seen).toHaveBeenCalledOnce();
		expect(core.get("states").count).toBe(1);
		handle.unsubscribe();
		core.dispose();
		expect(listeners.size).toBe(0);
		log.mockRestore();
	});
	it.each(["watch", "on", "execute"] as const)(
		"recovers shared XState %s setup without executing a failed window",
		async (mode) => {
			const actor = createActor(machine).start();
			const reason = { setup: mode };
			let failWatch = false;
			const core = xstateCore({
				source: actor,
				states: (s) => {
					if (failWatch) throw reason;
					return { count: s.context.count };
				},
				commands: ({ source: actor }) => ({
					add: () => actor.send({ type: "ADD" }),
				}),
				events: (event) => ({ changed: event<{ count: number }>() }),
			});
			// The ready cache already holds the native adapter subscription. Fail
			// this watch's projection setup, rather than an unused native subscribe.
			if (mode === "watch") failWatch = true;
			else
				vi.spyOn(actor, "on").mockImplementationOnce(() => {
					throw reason;
				});
			try {
				if (mode === "watch") core.watch(() => {});
				else if (mode === "on") core.on("changed", () => {});
				else await core.execute({ command: "add" });
				throw Error("expected failure");
			} catch (error) {
				expect(error).toBe(reason);
			}
			expect(actor.getSnapshot().context.count).toBe(0);
			failWatch = false;
			const seen = vi.fn();
			const watch = core.watch(seen);
			const event = core.on("changed", () => {});
			await core.execute({ command: "add" });
			expect(core.get("states").count).toBe(1);
			expect(seen).toHaveBeenCalledOnce();
			watch.unsubscribe();
			event.unsubscribe();
			core.dispose();
			actor.send({ type: "ADD" });
			expect(actor.getSnapshot().context.count).toBe(2);
			actor.stop();
		},
	);
	it.each(["watch", "on", "execute"] as const)(
		"recovers shared Actor-Web %s setup and preserves established consumers",
		async (mode) => {
			const { source, listeners, close } = sourceFixture();
			const reason = { setup: mode };
			let fail = false;
			const subscribe = source.subscribe;
			const events = new Set<(event: { type: "changed" }) => void>();
			const fullSource = {
				...source,
				subscribe(listener: Parameters<typeof subscribe>[0]) {
					if (fail && mode === "watch") throw reason;
					return subscribe(listener);
				},
				subscribeEvent(listener: (event: { type: "changed" }) => void) {
					if (fail && mode !== "watch") throw reason;
					events.add(listener);
					return () => events.delete(listener);
				},
			};
			const core = actorCore({
				source: fullSource,
				states: (s) => {
					if (fail && mode === "watch") throw reason;
					return { count: s.context.count };
				},
				commands: ({ source: actor }) => ({
					add: () => actor.send({ type: "add" }),
				}),
				events: (event) => ({ changed: event() }),
			});
			fail = true;
			try {
				if (mode === "watch") core.watch(() => {});
				else if (mode === "on") core.on("changed", () => {});
				else await core.execute({ command: "add" });
				throw Error("expected failure");
			} catch (error) {
				expect(error).toBe(reason);
			}
			expect(source.snapshot().context.count).toBe(0);
			// Failed additional work must preserve the ready cache's subscription.
			expect(listeners.size).toBe(1);
			expect(events.size).toBe(0);
			fail = false;
			core.get("states");
			const seen = vi.fn();
			const watched = core.watch(seen);
			const listened = core.on("changed", () => {});
			fail = true;
			if (mode !== "watch") {
				await expect(core.execute({ command: "add" })).rejects.toBe(reason);
				expect(listeners.size).toBe(1);
				expect(events.size).toBe(1);
			}
			fail = false;
			await core.execute({ command: "add" });
			expect(core.get("states").count).toBe(1);
			expect(seen).toHaveBeenCalledOnce();
			watched.unsubscribe();
			listened.unsubscribe();
			core.dispose();
			expect(listeners.size).toBe(0);
			expect(events.size).toBe(0);
			expect(close).not.toHaveBeenCalled();
		},
	);
	it("preserves a borrowed real XState actor after failed ready construction and retries construction", async () => {
		const actor = createActor(machine).start();
		const stop = vi.spyOn(actor, "stop");
		const reason = { temporary: true };
		let fail = true;
		const construct = () =>
			xstateCore({
				source: actor,
				states: (s) => {
					if (fail) throw reason;
					return { count: s.context.count };
				},
				commands: ({ source: actor }) => ({
					add: () => actor.send({ type: "ADD" }),
				}),
			});
		try {
			construct();
			throw Error("expected failure");
		} catch (error) {
			expect(error).toBe(reason);
		}
		fail = false;
		const core = construct();
		expect(core.get("states").count).toBe(0);
		const seen = vi.fn();
		const watch = core.watch(seen);
		await core.execute({ command: "add" });
		expect(actor.getSnapshot().context.count).toBe(1);
		expect(core.get("states").count).toBe(1);
		expect(seen).toHaveBeenCalledOnce();
		actor.send({ type: "ADD" });
		expect(core.get("states").count).toBe(2);
		expect(seen).toHaveBeenCalledTimes(2);
		watch.unsubscribe();
		core.dispose();
		expect(stop).not.toHaveBeenCalled();
		actor.stop();
	});
	it("retries failed Actor-Web ready construction with live reads, commands and watch", async () => {
		const { source, listeners, close } = sourceFixture();
		let fail = true;
		const reason = { temporary: true };
		const construct = () =>
			actorCore({
				source,
				states: (s) => {
					if (fail) throw reason;
					return { count: s.context.count };
				},
				commands: ({ source: actor }) => ({
					add: () => actor.send({ type: "add" }),
				}),
			});
		try {
			construct();
			throw Error("expected failure");
		} catch (error) {
			expect(error).toBe(reason);
		}
		expect(listeners.size).toBe(0);
		fail = false;
		const core = construct();
		expect(core.get("states").count).toBe(0);
		const seen = vi.fn();
		const watch = core.watch(seen);
		await core.execute({ command: "add" });
		expect(core.get("states").count).toBe(1);
		expect(seen).toHaveBeenCalledOnce();
		expect(listeners.size).toBe(1);
		await source.send();
		expect(core.get("states").count).toBe(2);
		expect(seen).toHaveBeenCalledTimes(2);
		watch.unsubscribe();
		core.dispose();
		expect(listeners.size).toBe(0);
		expect(close).not.toHaveBeenCalled();
	});
});

describe("web per-element acquisition rollback", () => {
	it.each([null, undefined, { render: "failed" }])(
		"drains later setup after exact render failure %s even if observer cleanup throws",
		async (reason) => {
			const log = vi.spyOn(console, "error").mockImplementation(() => {});
			const disconnect = MutationObserver.prototype.disconnect;
			const release = vi
				.spyOn(MutationObserver.prototype, "disconnect")
				.mockImplementationOnce(function (this: MutationObserver) {
					disconnect.call(this);
					throw Error("observer cleanup");
				});
			const sources: ReturnType<typeof sourceFixture>[] = [];
			const effects = vi.fn();
			const setters = vi.fn();
			let fail = true;
			const tag = `recovery-late-${reason === null ? "null" : reason === undefined ? "undefined" : "object"}`;
			const core = webCore({
				source: () => {
					const s = sourceFixture();
					sources.push(s);
					return s.source;
				},
				states: (s) => ({ count: s.context.count }),
				commands: ({ source: actor }) => ({
					setLabel(value: string) {
						setters(value);
					},
					add: () => actor.send({ type: "add" }),
				}),
				effects: () => {
					effects();
				},
			});
			core(tag, () => {
				if (fail) throw reason;
				return null;
			});
			const element = document.createElement(tag);
			element.setAttribute("label", "initial");
			const cls = customElements.get(tag);
			if (!cls) throw Error("missing element");
			try {
				cls.prototype.connectedCallback.call(element);
				throw Error("expected failure");
			} catch (error) {
				expect(error).toBe(reason);
			}
			expect(sources[0].close).toHaveBeenCalledOnce();
			expect(sources[0].listeners.size).toBe(0);
			expect(Reflect.has(element, "add")).toBe(false);
			element.setAttribute("label", "released");
			await sources[0].source.send();
			await Promise.resolve();
			expect(effects).not.toHaveBeenCalled();
			expect(setters).toHaveBeenCalledTimes(1);
			cls.prototype.disconnectedCallback.call(element);
			await Promise.resolve();
			expect(sources[0].close).toHaveBeenCalledOnce();
			fail = false;
			cls.prototype.connectedCallback.call(element);
			const add = Reflect.get(element, "add");
			await add();
			expect(sources[1].source.snapshot().context.count).toBe(1);
			cls.prototype.disconnectedCallback.call(element);
			await Promise.resolve();
			expect(sources[1].close).toHaveBeenCalledOnce();
			expect(sources[1].listeners.size).toBe(0);
			expect(log).toHaveBeenCalled();
			release.mockRestore();
			log.mockRestore();
		},
	);
	it("closes a failed collision source immediately and reconnects the same element", async () => {
		const sources: ReturnType<typeof sourceFixture>[] = [];
		let fail = true;
		const core = webCore({
			source: () => {
				const fixture = sourceFixture();
				sources.push(fixture);
				return fixture.source;
			},
			states: (): Record<string, number> => (fail ? { run: 0 } : {}),
			commands: ({ source: actor }) => ({
				run: () => actor.send({ type: "run" }),
			}),
		});
		core("recovery-web-collision", () => null);
		const element = document.createElement("recovery-web-collision");
		const elementClass = customElements.get("recovery-web-collision");
		if (!elementClass) throw Error("missing element");
		const connect = () =>
			elementClass.prototype.connectedCallback.call(element);
		const disconnect = () =>
			elementClass.prototype.disconnectedCallback.call(element);
		expect(connect).toThrow(/collision/);
		expect(sources[0].close).toHaveBeenCalledOnce();
		disconnect();
		await Promise.resolve();
		expect(sources[0].close).toHaveBeenCalledOnce();
		fail = false;
		connect();
		const run = Reflect.get(element, "run");
		await run();
		expect(sources[1].source.snapshot().context.count).toBe(1);
		expect(sources[0].source.snapshot().context.count).toBe(0);
		disconnect();
		await Promise.resolve();
		expect(sources[1].close).toHaveBeenCalledOnce();
		expect(sources.every((s) => s.listeners.size === 0)).toBe(true);
	});
});
