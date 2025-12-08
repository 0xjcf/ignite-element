import { makeAutoObservable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMobXAdapter, { type MobxEvent } from "../../adapters/MobxAdapter";
import type IgniteAdapter from "../../IgniteAdapter";
import { StateScope } from "../../IgniteAdapter";

class CounterStore {
	count = 0;

	constructor() {
		makeAutoObservable(this);
	}

	increment() {
		this.count += 1;
	}

	decrement() {
		this.count -= 1;
	}
}

const createCounterStore = () => new CounterStore();

class AdvancedCounterStore {
	count = 0;
	lastLegacyPayload: unknown = null;

	add = (amount: number) => {
		this.count += amount;
	};

	legacyUpdate = (payload: unknown) => {
		this.lastLegacyPayload = payload;
	};

	constructor() {
		makeAutoObservable(this);
	}
}

const createAdvancedStore = () => new AdvancedCounterStore();

type TestMobxAdapterFactory<State extends object> = (() => IgniteAdapter<
	State,
	MobxEvent<State>
>) & {
	scope: StateScope;
	resolveStateSnapshot: (
		adapter: IgniteAdapter<State, MobxEvent<State>>,
	) => State;
	resolveCommandActor: (
		adapter: IgniteAdapter<State, MobxEvent<State>>,
	) => State;
};

describe("MobXAdapter", () => {
	type Counter = ReturnType<typeof createCounterStore>;

	let adapterFactory: TestMobxAdapterFactory<Counter>;
	let adapter: IgniteAdapter<Counter, MobxEvent<Counter>>;

	beforeEach(() => {
		adapterFactory = createMobXAdapter(createCounterStore);
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
		expect(adapterFactory.scope).toBe(StateScope.Isolated);
		expect(adapter.scope).toBe(StateScope.Isolated);
	});

	it("exposes facade metadata for isolated adapters", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapter);
		expect(snapshot.count).toBe(0);
		const store = adapterFactory.resolveCommandActor(adapter);
		expect(typeof store.increment).toBe("function");
		store.increment();
		expect(adapter.getState().count).toBe(1);
	});

	it("throws when store factory does not return an observable", () => {
		const invalidFactory = () => ({ count: 0 });
		expect(() => createMobXAdapter(invalidFactory)()).toThrow(
			"[MobxAdapter] store factory must return a MobX observable.",
		);
	});

	it("throws when source is not a MobX observable", () => {
		expect(() => createMobXAdapter({ count: 0 })).toThrow(
			"[MobxAdapter] Unsupported source. Provide a MobX observable or a factory function.",
		);
	});
});

describe("MobXAdapter with shared observable", () => {
	type SharedStore = CounterStore;
	let sharedStore: SharedStore;

	let adapterFactory: TestMobxAdapterFactory<SharedStore>;
	let adapterA: IgniteAdapter<SharedStore, MobxEvent<SharedStore>>;
	let adapterB: IgniteAdapter<SharedStore, MobxEvent<SharedStore>>;

	beforeEach(() => {
		sharedStore = new CounterStore();
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
		expect(adapterFactory.scope).toBe(StateScope.Shared);
		expect(adapterA.scope).toBe(StateScope.Shared);
		expect(adapterB.scope).toBe(StateScope.Shared);
	});

	it("reuses the same observable instance", () => {
		adapterA.send({ type: "increment" });
		expect(adapterB.getState().count).toBe(1);

		adapterB.send({ type: "increment" });
		expect(adapterA.getState().count).toBe(2);
	});

	it("exposes facade metadata for shared adapters", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapterA);
		expect(snapshot.count).toBe(sharedStore.count);
		const store = adapterFactory.resolveCommandActor(adapterA);
		expect(store).toBe(sharedStore);
		store.increment();
		expect(adapterB.getState().count).toBe(1);
	});

	it("errors when resolving metadata for unknown adapters", () => {
		const sharedFactory: TestMobxAdapterFactory<CounterStore> =
			createMobXAdapter(createCounterStore);
		const otherFactory = createMobXAdapter(createCounterStore);
		const unknownAdapter = otherFactory();

		expect(() => sharedFactory.resolveStateSnapshot(unknownAdapter)).toThrow(
			"[MobxAdapter] Unable to resolve snapshot for facade callbacks.",
		);

		expect(() => sharedFactory.resolveCommandActor(unknownAdapter)).toThrow(
			"[MobxAdapter] Unable to resolve actor for facade callbacks.",
		);

		unknownAdapter.stop();
	});
});

describe("MobXAdapter send variants", () => {
	it("applies arguments when event supplies args", () => {
		const factory = createMobXAdapter(createAdvancedStore);
		const adapter = factory();
		const store = factory.resolveCommandActor(adapter);
		adapter.send({ type: "add", args: [4] });
		expect(store.count).toBe(4);
		adapter.stop();
	});

	it("passes arguments to methods that accept them", () => {
		const factory = createMobXAdapter(createAdvancedStore);
		const adapter = factory();
		const store = factory.resolveCommandActor(adapter);
		const payload = { value: 99 };
		adapter.send({ type: "legacyUpdate", args: [payload] });
		expect(store.lastLegacyPayload).toEqual(payload);
		adapter.stop();
	});
});
