import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMobXAdapter, {
	type FunctionKeys,
} from "../../adapters/MobxAdapter";
import counterStore from "../../examples/mobx/mobxCounterStore";
import type IgniteAdapter from "../../IgniteAdapter";
import { StateScope } from "../../IgniteAdapter";

describe("MobXAdapter", () => {
	type Counter = ReturnType<typeof counterStore>;

	interface Event {
		type: FunctionKeys<Counter>;
	}

	let adapterFactory: () => IgniteAdapter<Counter, Event>;
	let adapter: ReturnType<typeof adapterFactory>;

	beforeEach(() => {
		adapterFactory = createMobXAdapter(counterStore);
		adapter = adapterFactory();
	});

	afterEach(() => {
		adapter.stop();
		vi.clearAllMocks();
	});

	it("should initialize and return the current state", () => {
		expect(adapter).toBeDefined();
		expect(adapter.getState().count).toBe(0);
	});

	it("should dispatch actions to the store and update state", () => {
		adapter.send({ type: "increment" });
		expect(adapter.getState().count).toBe(1);

		adapter.send({ type: "decrement" });
		expect(adapter.getState().count).toBe(0);
	});

	it("should handle multiple subscriptions and notify listeners", () => {
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		adapter.subscribe(listener1);
		adapter.subscribe(listener2);

		adapter.send({ type: "increment" });

		expect(listener1).toHaveBeenCalledTimes(2);
		expect(listener2).toHaveBeenCalledTimes(2);
	});

	it("should clean up subscriptions when stopped", () => {
		const consoleErrorMock = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const listener = vi.fn();
		adapter.subscribe(listener);
		adapter.stop();
		adapter.send({ type: "increment" });

		// Listener should only have been called once (for the initial state)
		expect(listener).toHaveBeenCalledTimes(1);
		expect(consoleErrorMock).toHaveBeenCalledWith(
			expect.stringContaining("Cannot send events when adapter is stopped"),
		);

		consoleErrorMock.mockRestore(); // Restore original console.error
	});

	it("should log a warning when send is called after stop", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		adapter.stop();
		adapter.send({ type: "increment" });

		expect(warnSpy).toHaveBeenCalledWith(
			"[MobxAdapter] Cannot send events when adapter is stopped.",
		);

		warnSpy.mockRestore();
	});

	it("should log a warning for unknown events", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		// @ts-expect-error This error is expected because `unknownAction` is not part of the defined event types.
		adapter.send({ type: "unknownAction" });

		expect(warnSpy).toHaveBeenCalledWith(
			"[MobxAdapter] Unknown event type: unknownAction",
		);

		warnSpy.mockRestore();
	});

	it("should return the last known state after stop", () => {
		adapter.send({ type: "increment" });
		adapter.stop();

		expect(adapter.getState().count).toBe(1);
	});

	it("should prevent new subscriptions after stop", () => {
		adapter.stop();
		expect(() => adapter.subscribe(vi.fn())).toThrowError(
			"Adapter is stopped and cannot subscribe.",
		);
	});

	it("should allow multiple calls to stop without error", () => {
		adapter.stop();
		expect(() => adapter.stop()).not.toThrow();
	});

	it("should allow unsubscribe calls before and after stop without errors", () => {
		const listener = vi.fn();
		const subscription = adapter.subscribe(listener);

		expect(() => subscription.unsubscribe()).not.toThrow();

		adapter.stop();
		expect(() => subscription.unsubscribe()).not.toThrow();
	});

	it("marks factory adapters as isolated", () => {
		expect(
			(adapterFactory as typeof adapterFactory & { scope: StateScope }).scope,
		).toBe(StateScope.Isolated);
		expect(adapter.scope).toBe(StateScope.Isolated);
	});
});

describe("MobXAdapter with shared observable", () => {
	const sharedStore = counterStore();

	let adapterFactory: () => IgniteAdapter<
		ReturnType<typeof counterStore>,
		{ type: FunctionKeys<ReturnType<typeof counterStore>> }
	>;
	let adapterA: IgniteAdapter<
		ReturnType<typeof counterStore>,
		{ type: FunctionKeys<ReturnType<typeof counterStore>> }
	>;
	let adapterB: IgniteAdapter<
		ReturnType<typeof counterStore>,
		{ type: FunctionKeys<ReturnType<typeof counterStore>> }
	>;

	beforeEach(() => {
		adapterFactory = createMobXAdapter(sharedStore);
		adapterA = adapterFactory();
		adapterB = adapterFactory();
	});

	afterEach(() => {
		adapterA.stop();
		adapterB.stop();
		vi.clearAllMocks();
	});

	it("sets scope to shared", () => {
		expect(
			(adapterFactory as typeof adapterFactory & { scope: StateScope }).scope,
		).toBe(StateScope.Shared);
		expect(adapterA.scope).toBe(StateScope.Shared);
		expect(adapterB.scope).toBe(StateScope.Shared);
	});

	it("reuses the same observable instance", () => {
		adapterA.send({ type: "increment" });
		expect(adapterB.getState().count).toBe(1);

		adapterB.send({ type: "increment" });
		expect(adapterA.getState().count).toBe(2);
	});
});
