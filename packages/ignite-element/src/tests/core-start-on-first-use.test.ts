import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, fromCallback } from "xstate";
import { igniteCore as mobxCore } from "../mobx";
import { igniteCore as reduxCore } from "../redux";
import { acquireBindingStore } from "../runtime/bindings";
import { igniteCore } from "../xstate";

const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		add: (state) => {
			state.count += 1;
		},
	},
});

function privateMachine() {
	const invoked = vi.fn();
	const released = vi.fn();
	const timed = vi.fn();
	const machine = createMachine({
		types: {} as {
			context: { count: number };
			events: { type: "ADD" } | { type: "PING" };
		},
		context: { count: 0 },
		invoke: {
			src: fromCallback(() => {
				invoked();
				return () => {
					released();
				};
			}),
		},
		after: {
			30: {
				actions: () => {
					timed();
				},
			},
		},
		on: {
			ADD: {
				actions: assign({ count: ({ context }) => context.count + 1 }),
			},
			PING: {
				actions: assign({ count: ({ context }) => context.count + 1 }),
			},
		},
	});
	return { machine, invoked, released, timed };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("independent cores start on first use", () => {
	it("does not run timers or invoked actors on an untouched core", () => {
		vi.useFakeTimers();
		const { machine, invoked, timed } = privateMachine();
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: () => source.send({ type: "ADD" }),
			}),
		});
		core.get("schema");
		const binding = acquireBindingStore(core);
		binding.read();
		vi.advanceTimersByTime(1_000);
		expect(invoked).not.toHaveBeenCalled();
		expect(timed).not.toHaveBeenCalled();
		core.dispose();
		expect(invoked).not.toHaveBeenCalled();
	});

	it("starts invoked actors and timers on get('states')", () => {
		vi.useFakeTimers();
		const { machine, invoked, timed, released } = privateMachine();
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
		});
		expect(core.get("states")).toEqual({ count: 0 });
		expect(invoked).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(30);
		expect(timed).toHaveBeenCalledOnce();
		core.dispose();
		expect(released).toHaveBeenCalledOnce();
	});

	it("starts invoked actors and timers on execute", async () => {
		vi.useFakeTimers();
		const { machine, invoked, timed, released } = privateMachine();
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: () => ({
				noop: () => undefined,
			}),
		});
		await core.execute({ command: "noop" });
		expect(invoked).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(30);
		expect(timed).toHaveBeenCalledOnce();
		core.dispose();
		expect(released).toHaveBeenCalledOnce();
	});

	it("starts a lazy actor on send", () => {
		vi.useFakeTimers();
		const { machine, invoked, timed, released } = privateMachine();
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				ping: () => source.send({ type: "PING" }),
			}),
		});
		const binding = acquireBindingStore(core);
		const detach = binding.attach?.();
		expect(invoked).not.toHaveBeenCalled();
		const ping = binding.read().ping;
		if (typeof ping !== "function") throw new Error("missing send command");
		ping();
		expect(invoked).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(30);
		expect(timed).toHaveBeenCalledOnce();
		expect(binding.read().count).toBe(1);
		detach?.();
		core.dispose();
		expect(released).toHaveBeenCalled();
	});

	it("keeps a user-started shared source on one actor", async () => {
		const { machine, invoked, released } = privateMachine();
		const actor = createActor(machine).start();
		const start = vi.spyOn(actor, "start");
		const stop = vi.spyOn(actor, "stop");
		const core = igniteCore({
			source: actor,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source }) => ({
				add: () => source.send({ type: "ADD" }),
			}),
		});
		expect(start).toHaveBeenCalledOnce();
		start.mockClear();
		expect(core.get("states")).toEqual({ count: 0 });
		await core.execute({ command: "add" });
		expect(core.get("states").count).toBe(1);
		expect(actor.getSnapshot().context.count).toBe(1);
		expect(invoked).toHaveBeenCalledOnce();
		expect(start).not.toHaveBeenCalled();
		core.dispose();
		expect(stop).not.toHaveBeenCalled();
		expect(released).not.toHaveBeenCalled();
		actor.stop();
		expect(released).toHaveBeenCalledOnce();
	});

	it("subscribes redux on get('states')", () => {
		const observed = { active: 0 };
		const core = reduxCore({
			source: () => observedStore(observed),
			states: (state) => ({ count: state.count }),
		});
		expect(observed.active).toBe(0);
		expect(core.get("states")).toEqual({ count: 0 });
		expect(observed.active).toBe(1);
		core.dispose();
		expect(observed.active).toBe(0);
	});

	it("subscribes redux on execute and dispatch", async () => {
		const observed = { active: 0 };
		const core = reduxCore({
			source: () => observedStore(observed),
			states: (state) => ({ count: state.count }),
			commands: ({ source: store }) => ({
				add: () => store.dispatch(slice.actions.add()),
				noop: () => undefined,
			}),
		});
		await core.execute({ command: "noop" });
		expect(observed.active).toBe(1);
		await core.execute({ command: "add" });
		expect(observed.active).toBe(1);
		expect(core.get("states")).toEqual({ count: 1 });
		core.dispose();
		expect(observed.active).toBe(0);
	});

	it("observes mobx on get('states')", () => {
		const observed = { active: 0 };
		const core = mobxCore({
			source: () => observedObservable(observed),
			states: (state) => ({ count: state.count }),
		});
		expect(observed.active).toBe(0);
		expect(core.get("states")).toEqual({ count: 0 });
		expect(observed.active).toBe(1);
		core.dispose();
		expect(observed.active).toBe(0);
	});

	it("observes mobx on execute and send", async () => {
		const observed = { active: 0 };
		const core = mobxCore({
			source: () => observedObservable(observed),
			states: (state) => ({ count: state.count }),
			commands: ({ source: store }) => ({
				add: () => store.add(),
				noop: () => store.noop(),
			}),
		});
		await core.execute({ command: "noop" });
		expect(observed.active).toBe(1);
		await core.execute({ command: "add" });
		expect(observed.active).toBe(1);
		expect(core.get("states")).toEqual({ count: 1 });
		core.dispose();
		expect(observed.active).toBe(0);
	});

	it("rejects an invalid MobX projection from execute before the command runs", async () => {
		const observed = { active: 0 };
		let ran = false;
		const core = mobxCore({
			source: () => observedObservable(observed),
			states: (state) => ({ meter: new Meter(state.count) }),
			commands: ({ source: store }) => ({
				add: () => {
					ran = true;
					store.add();
				},
			}),
		});
		await expect(core.execute({ command: "add" })).rejects.toThrow(
			/class instance/i,
		);
		expect(ran).toBe(false);
		expect(observed.active).toBe(0);
		expect(() => core.get("states")).toThrow(/class instance/i);
		expect(observed.active).toBe(0);
		core.dispose();
	});

	it("does not observe when execute names an unknown command", async () => {
		const reduxObserved = { active: 0 };
		const mobxObserved = { active: 0 };
		const redux = reduxCore({
			source: () => observedStore(reduxObserved),
			states: (state) => ({ count: state.count }),
			commands: () => ({ add: () => undefined }),
		});
		const mobx = mobxCore({
			source: () => observedObservable(mobxObserved),
			states: (state) => ({ count: state.count }),
			commands: () => ({ add: () => undefined }),
		});
		await expect(
			redux.execute({ command: "missing" as "add" }),
		).rejects.toThrow(/unknown command/i);
		await expect(mobx.execute({ command: "missing" as "add" })).rejects.toThrow(
			/unknown command/i,
		);
		expect(reduxObserved.active).toBe(0);
		expect(mobxObserved.active).toBe(0);
		redux.dispose();
		mobx.dispose();
	});

	it("keeps observation through an async command after its watch unsubscribes", async () => {
		const gate = deferred<void>();
		const reduxObserved = { active: 0 };
		const mobxObserved = { active: 0 };
		let reduxListenersAtDispatch = -1;
		let mobxObservedAtSend = -1;
		const redux = reduxCore({
			source: () => observedStore(reduxObserved),
			states: (state) => ({ count: state.count }),
			commands: ({ source: store }) => ({
				add: async () => {
					await gate.promise;
					reduxListenersAtDispatch = reduxObserved.active;
					store.dispatch(slice.actions.add());
				},
			}),
		});
		const mobx = mobxCore({
			source: () => observedObservable(mobxObserved),
			states: (state) => ({ count: state.count }),
			commands: ({ source: store }) => ({
				add: async () => {
					await gate.promise;
					mobxObservedAtSend = mobxObserved.active;
					store.add();
				},
			}),
		});
		const reduxWatch = redux.watch(() => undefined);
		const mobxWatch = mobx.watch(() => undefined);
		const reduxRun = redux.execute({ command: "add" });
		const mobxRun = mobx.execute({ command: "add" });
		await Promise.resolve();
		reduxWatch.unsubscribe();
		mobxWatch.unsubscribe();
		gate.resolve();
		await reduxRun;
		await mobxRun;
		expect(reduxListenersAtDispatch).toBeGreaterThan(0);
		expect(mobxObservedAtSend).toBeGreaterThan(0);
		expect(redux.get("states").count).toBe(1);
		expect(mobx.get("states").count).toBe(1);
		redux.dispose();
		mobx.dispose();
		expect(reduxObserved.active).toBe(0);
		expect(mobxObserved.active).toBe(0);
	});
});

class Meter {
	constructor(readonly count: number) {}
}

function deferred<T>() {
	let resolvePromise!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});
	return { promise, resolve: resolvePromise };
}

function observedStore(observed: { active: number }) {
	const store = configureStore({ reducer: slice.reducer });
	const subscribe = store.subscribe.bind(store);
	store.subscribe = (listener) => {
		observed.active += 1;
		const off = subscribe(listener);
		return () => {
			observed.active -= 1;
			off();
		};
	};
	return store;
}

function observedObservable(observed: { active: number }) {
	const store = makeAutoObservable({
		count: 0,
		add() {
			this.count += 1;
		},
		noop() {},
	});
	onBecomeObserved(store, "count", () => {
		observed.active += 1;
	});
	onBecomeUnobserved(store, "count", () => {
		observed.active -= 1;
	});
	return store;
}
