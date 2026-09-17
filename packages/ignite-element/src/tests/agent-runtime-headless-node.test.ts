// @vitest-environment node
//
// The headless agent runtime must be DOM-free: getSchema()/execute()/on()/
// watchStates() have to work in pure Node (no jsdom). Before the createRuntimeHost
// fix these threw "document is not defined" via createRuntimeHost ->
// document.createElement. This file runs in the `node` environment (overriding
// the package's global jsdom) so it would fail without a genuinely DOM-free
// runtime. The DOM render path is intentionally not exercised here — it still
// requires a real DOM.

import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import { assign, setup } from "xstate";
import { igniteCore as igniteRedux } from "../redux";
import { igniteCore } from "../xstate";

it("characterizes live-source effect retention separately from per-handle cleanup", () => {
	const source = configureStore({ reducer: (state = { count: 0 }) => state });
	const subscribe = source.subscribe.bind(source);
	const owned = new Set<() => void>();
	const spy = vi.spyOn(source, "subscribe").mockImplementation((listener) => {
		const unsubscribe = subscribe(listener);
		const release = () => {
			unsubscribe();
			owned.delete(release);
		};
		owned.add(release);
		return release;
	});
	try {
		for (let index = 0; index < 2; index += 1) {
			const core = igniteRedux({ source, effects: () => {} });
			core.get("states");
			const handle = core.watch(() => {});
			handle.unsubscribe();
			expect(owned.size).toBeGreaterThan(0);
			core.dispose();
		}
		expect(owned.size).toBe(0);
	} finally {
		for (const release of owned) release();
		spy.mockRestore();
	}
	expect(owned.size).toBe(0);
	expect(source.getState()).toEqual({ count: 0 });
});

function createCounter() {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "DEC" } | { type: "INC" },
		},
	}).createMachine({
		id: "headless-counter",
		context: { count: 0 },
		initial: "active",
		states: {
			active: {
				on: {
					INC: {
						actions: assign({ count: ({ context }) => context.count + 1 }),
					},
					DEC: {
						actions: assign({
							count: ({ context }) => Math.max(0, context.count - 1),
						}),
					},
				},
			},
		},
	});

	return igniteCore({
		source: machine,
		events: (event) => ({ counted: event<{ count: number }>() }),
		states: (snapshot) => ({
			count: snapshot.context.count,
			canDecrement: snapshot.context.count > 0,
		}),
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INC" }),
			decrement: () => actor.send({ type: "DEC" }),
		}),
		effects: ({ emit, select }) => {
			const count = select((state) => state.context.count);
			if (count.changed) {
				emit({ type: "counted", count: count.current });
			}
		},
	});
}

describe("agent runtime is DOM-free (pure Node, no jsdom)", () => {
	it("runs in an environment with no document", () => {
		expect(typeof document).toBe("undefined");
	});

	it("pure discovery stays unknown until preparation without a DOM", () => {
		const counter = createCounter();
		const before = counter.get("schema");
		expect(before.commands).toBeNull();
		counter.get("states");
		expect(counter.get("commands")).toEqual({
			increment: { input: null },
			decrement: { input: null },
		});
		expect(before.commands).toBeNull();
		expect(before.events).toContainEqual({ type: "counted", payload: null });
		expect(before.states).toEqual({ schema: null });
		counter.dispose();
	});

	it("derived availability follows the native source and does not replace enforcement", async () => {
		const counter = createCounter();

		expect(counter.get("states").canDecrement).toBe(false);
		await counter.execute({ command: "decrement" });
		expect(counter.get("states").count).toBe(0);

		await counter.execute({ command: "increment" });
		expect(counter.get("states").canDecrement).toBe(true);

		await counter.execute({ command: "decrement" });
		expect(counter.get("states").canDecrement).toBe(false);
		expect(counter).not.toHaveProperty("canExecute");
		counter.dispose();
	});

	it("execute() runs a command and returns the post-ack snapshot + events", async () => {
		const counter = createCounter();
		const result = await counter.execute({ command: "increment" });
		expect(result.snapshot.context.count).toBe(1);
		expect(result.events).toEqual([{ type: "counted", count: 1 }]);
	});

	it("on() receives effect-emitted events via the host EventTarget", async () => {
		const counter = createCounter();
		const handler = vi.fn();
		const subscription = counter.on("counted", handler);

		await counter.execute({ command: "increment" });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler.mock.calls[0][0]).toEqual({ type: "counted", count: 1 });
		subscription.unsubscribe();
	});

	it("watchStates()/getStates() observe the derived states without a DOM", async () => {
		const counter = createCounter();
		const seen: Array<{ count: number }> = [];
		const subscription = counter.watch((states) => seen.push(states));

		await counter.execute({ command: "increment" });

		expect(counter.get("states")).toEqual({ count: 1, canDecrement: true });
		expect(seen[seen.length - 1]).toEqual({ count: 1, canDecrement: true });
		subscription.unsubscribe();
	});

	it("releases observation handles without terminating the headless source", async () => {
		const counter = createCounter();
		const eventHandler = vi.fn();
		const viewHandler = vi.fn();
		const eventSubscription = counter.on("counted", eventHandler);
		const viewSubscription = counter.watch(viewHandler);

		eventSubscription.unsubscribe();
		viewSubscription.unsubscribe();

		const result = await counter.execute({ command: "increment" });

		expect(result.snapshot.context.count).toBe(1);
		expect(eventHandler).not.toHaveBeenCalled();
		expect(viewHandler).not.toHaveBeenCalled();
		expect(counter.get("states").canDecrement).toBe(true);
	});
});
