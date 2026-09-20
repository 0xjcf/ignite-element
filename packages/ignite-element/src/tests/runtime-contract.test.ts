import type { IgniteAdapter } from "@ignite-element/core";
import * as root from "ignite-element";
import * as actorWeb from "ignite-element/actor-web";
import * as mobx from "ignite-element/mobx";
import * as redux from "ignite-element/redux";
import * as xstate from "ignite-element/xstate";
import { describe, expect, it, vi } from "vitest";
import { createActor, createMachine } from "xstate";
import { createAgentRuntime } from "../runtime/agent";
import { createLifetime } from "../runtime/lifetime";
import counterStore, { counterSlice } from "./fixtures/reduxCounterStore";

describe("retired testing and recording API", () => {
	for (const [name, entry] of Object.entries({
		root,
		xstate,
		redux,
		mobx,
		actorWeb,
	})) {
		it(`${name} has no testing export`, () => {
			expect(entry).not.toHaveProperty("test");
		});
	}

	it("source-backed runtime retains ordinary testability without recording", async () => {
		const source = createActor(
			createMachine({ initial: "ready", states: { ready: {} } }),
		).start();
		try {
			const core = xstate.igniteCore({
				source,
				commands: () => ({ ping: () => undefined }),
			});
			expect(core).not.toHaveProperty("record");
			expect(source.getSnapshot().value).toBe("ready");
			expect(core.get("commands")).toEqual({ ping: { input: null } });
			expect(await core.execute({ command: "ping" })).toBeUndefined();
		} finally {
			source.stop();
		}
	});
});

const createCounter = () => {
	const store = counterStore();
	const core = redux.igniteCore({
		source: store,
		states: (snapshot) => ({ count: snapshot.counter.count, label: "Count" }),
		commands: ({ source: actor }) => ({
			increment: (amount: number) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount)),
			maybeIncrement: (amount?: number) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount ?? 1)),
			decrement: () => actor.dispatch(counterSlice.actions.decrement()),
			fail: () => {
				throw new Error("command failed");
			},
		}),
		events: (event) => ({ changed: event<{ count: number }>() }),
		effects: ({ snapshot, prevSnapshot, emit }) => {
			if (snapshot.counter.count !== prevSnapshot.counter.count) {
				emit({ type: "changed", count: snapshot.counter.count });
			}
		},
	});
	return { store, core };
};

describe("ordinary runtime assertions", () => {
	it("preserves source mutation, projected reads and derived availability", async () => {
		const { core, store } = createCounter();
		const canDecrement = () => core.get("states").count > 0;
		expect(store.getState()).toEqual({ counter: { count: 0 } });
		expect(canDecrement()).toBe(false);
		const captured: Array<{ type: string; [key: string]: unknown }> = [];
		const eventHandles = [core.on("changed", (event) => captured.push(event))];
		await core.execute({ command: "increment", input: 2 });
		for (const handle of eventHandles) handle.unsubscribe();
		expect(store.getState()).toEqual({ counter: { count: 2 } });
		expect(core.get("states")).toEqual({ count: 2, label: "Count" });
		expect(captured).toEqual([{ type: "changed", count: 2 }]);
		expect(core.get("schema").states).toEqual({ schema: null });
		expect(core.get("schema")).not.toHaveProperty("snapshot");
		expect(core.get("schema")).not.toHaveProperty("view");
		expect(canDecrement()).toBe(true);
		await core.execute({ command: "decrement" });
		await core.execute({ command: "maybeIncrement" });
		await core.execute({ command: "maybeIncrement", input: 3 });
		expect(core.get("states").count).toBe(5);
	});

	it("observes external source updates and releases each ordinary subscription", async () => {
		const { store, core } = createCounter();
		const snapshots = vi.fn(),
			states = vi.fn(),
			events = vi.fn();
		const handles = [
			{ unsubscribe: store.subscribe(() => snapshots(store.getState())) },
			core.watch(states),
			core.on("changed", events),
		];
		try {
			store.dispatch(counterSlice.actions.addByAmount(2));
			await vi.waitFor(() =>
				expect(events).toHaveBeenCalledWith({ type: "changed", count: 2 }),
			);
			expect(snapshots).toHaveBeenCalledWith({ counter: { count: 2 } });
			expect(states).toHaveBeenCalledWith(
				{ count: 2, label: "Count" },
				{ count: 0, label: "Count" },
			);
		} finally {
			for (const handle of handles) handle.unsubscribe();
		}
		snapshots.mockClear();
		states.mockClear();
		events.mockClear();
		store.dispatch(counterSlice.actions.addByAmount(1));
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(snapshots).not.toHaveBeenCalled();
		expect(states).not.toHaveBeenCalled();
		expect(events).not.toHaveBeenCalled();
		expect(store.getState().counter.count).toBe(3);
	});

	it("keeps emitted event order and multiplicity across commands without a recorder", async () => {
		const { core } = createCounter();
		const received: number[] = [];
		const subscription = core.on("changed", (event) =>
			received.push(event.count),
		);
		try {
			for (const amount of [1, 2, -2])
				await core.execute({ command: "increment", input: amount });
			expect(received).toEqual([1, 3, 1]);
		} finally {
			subscription.unsubscribe();
		}
	});

	it("preserves command errors and allows subsequent successful execution", async () => {
		const { core } = createCounter();
		await expect(core.execute({ command: "fail" })).rejects.toThrow(
			"command failed",
		);
		await expect(
			core.execute({ command: "increment", input: 1 }),
		).resolves.toEqual(counterSlice.actions.addByAmount(1));
		expect(core.get("states").count).toBe(1);
	});

	it("allows commands with nullable native snapshots and explicit projected reads", async () => {
		const adapter: IgniteAdapter<null, never> = {
			getSnapshot: () => null,
			send: () => {},
			stop: () => {},
			subscribeSnapshots: () => ({ unsubscribe() {} }),
		};
		const lifetime = createLifetime();
		const { runtime } = createAgentRuntime({
			lifetime,
			dispose: () => lifetime.dispose(),
			eventTypes: [],
			resolveStates: () => ({ available: false }),
			resolveRuntime: () => ({
				adapter,
				host: new EventTarget(),
				additionalArgs: { noop: () => undefined },
			}),
		});
		expect(await runtime.execute({ command: "noop" })).toBeUndefined();
		expect(runtime.get("states")).toEqual({ available: false });
		runtime.dispose();
	});
});
