import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createReduxAdapter from "../../adapters/ReduxAdapter";
import counterStore, {
	counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import type IgniteAdapter from "../../IgniteAdapter";
import { StateScope } from "../../IgniteAdapter";
import type {
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../../RenderArgs";
import type { InferStateAndEvent } from "../../utils/igniteRedux";

type StoreAdapterTypes = InferStateAndEvent<typeof counterStore>;

type TestReduxAdapterFactory<State, Event, Actor> = (() => IgniteAdapter<
	State,
	Event
>) & {
	scope: StateScope;
	resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => State;
	resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => Actor;
};

/**
 * Tests for Slice Source
 */
describe("ReduxAdapter with Slice Source", () => {
	// Infer types from Slice
	type IgniteRedux = InferStateAndEvent<typeof counterSlice>;

	type State = IgniteRedux["State"];
	type Event = IgniteRedux["Event"];

	let adapterFactory: TestReduxAdapterFactory<
		State,
		Event,
		ReduxSliceCommandActor<typeof counterSlice>
	>;
	let adapter: IgniteAdapter<State, Event>;

	beforeEach(() => {
		adapterFactory = createReduxAdapter(counterSlice);
		adapter = adapterFactory();
	});

	afterEach(() => {
		adapter.stop(); // Ensure adapter is stopped after each test
		vi.clearAllMocks();
	});

	it("should initialize and return the current state", () => {
		expect(adapter).toBeDefined();
		expect(adapter.getState()).toEqual({ counter: { count: 0 } });
	});

	it("should dispatch actions and update state", () => {
		adapter.send({ type: "counter/increment" });
		expect(adapter.getState()).toEqual({ counter: { count: 1 } });

		adapter.send({ type: "counter/addByAmount", payload: 5 });
		expect(adapter.getState()).toEqual({ counter: { count: 6 } });

		adapter.send({ type: "counter/decrement" });
		expect(adapter.getState()).toEqual({ counter: { count: 5 } });
	});

	it("should prevent invalid actions", () => {
		// @ts-expect-error Invalid action type
		adapter.send({ type: "counter/unknownAction" });
		expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // No state change
	});

	it("marks slice adapters as isolated", () => {
		expect(adapterFactory.scope).toBe(StateScope.Isolated);
		expect(adapter.scope).toBe(StateScope.Isolated);
	});

	it("exposes facade metadata for slice adapters", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapter);
		expect(snapshot.counter.count).toBe(0);
		const actor = adapterFactory.resolveCommandActor(adapter);
		actor.dispatch(counterSlice.actions.increment());
		expect(adapter.getState().counter.count).toBe(1);
	});
});

/**
 * Tests for Store Source
 */
describe("ReduxAdapter with Store Source", () => {
	// Infer types from Store and explicitly pass actions
	type State = StoreAdapterTypes["State"];
	type Event = StoreAdapterTypes["Event"];

	let adapterFactory: TestReduxAdapterFactory<
		State,
		Event,
		ReduxStoreCommandActor<ReturnType<typeof counterStore>>
	>;
	let adapter: IgniteAdapter<State, Event>;

	beforeEach(() => {
		adapterFactory = createReduxAdapter(counterStore);
		adapter = adapterFactory();
	});

	afterEach(() => {
		adapter.stop(); // Ensure adapter is stopped after each test
		vi.clearAllMocks();
	});

	it("should initialize and return the current state", () => {
		expect(adapter).toBeDefined();
		expect(adapter.getState()).toEqual({ counter: { count: 0 } });
	});

	it("should dispatch actions and update state", () => {
		adapter.send(counterSlice.actions.increment());
		expect(adapter.getState()).toEqual({ counter: { count: 1 } });

		adapter.send(counterSlice.actions.addByAmount(5));
		expect(adapter.getState()).toEqual({ counter: { count: 6 } });

		adapter.send(counterSlice.actions.decrement());
		expect(adapter.getState()).toEqual({ counter: { count: 5 } });
	});

	it("should prevent invalid actions", () => {
		adapter.send({ type: "counter/unknownAction" });
		expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // No state change
	});

	it("should prevent actions after adapter is stopped", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		adapter.stop(); // Stop adapter
		adapter.send(counterSlice.actions.increment());

		expect(warnSpy).toHaveBeenCalledWith(
			"[ReduxAdapter] Cannot send events when adapter is stopped.",
		);

		expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // State should not change
		warnSpy.mockRestore();
	});

	it("marks factory adapters as isolated", () => {
		expect(adapterFactory.scope).toBe(StateScope.Isolated);
		expect(adapter.scope).toBe(StateScope.Isolated);
	});

	it("exposes facade metadata for store factories", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapter);
		expect(snapshot.counter.count).toBe(0);
		const actor = adapterFactory.resolveCommandActor(adapter);
		actor.dispatch(counterSlice.actions.increment());
		expect(adapter.getState().counter.count).toBe(1);
	});
});

/**
 * Tests for Subscribe Method
 */
describe("ReduxAdapter - Subscribe Method", () => {
	type State = StoreAdapterTypes["State"];
	type Event = StoreAdapterTypes["Event"];

	let adapterFactory: () => IgniteAdapter<State, Event>;
	let adapter: IgniteAdapter<State, Event>;

	beforeEach(() => {
		adapterFactory = createReduxAdapter(counterStore);
		adapter = adapterFactory();
	});

	afterEach(() => {
		adapter.stop(); // Ensure adapter is stopped after each test
		vi.clearAllMocks();
	});

	it("should notify listeners on state updates", () => {
		const listener = vi.fn();

		const subscription = adapter.subscribe(listener); // Subscribe
		expect(listener).toHaveBeenCalledWith({ counter: { count: 0 } }); // Initial state

		adapter.send(counterSlice.actions.increment());
		expect(listener).toHaveBeenCalledWith({ counter: { count: 1 } }); // Update state

		subscription.unsubscribe(); // Unsubscribe
	});

	it("should not notify listeners after unsubscribe", () => {
		const listener = vi.fn();

		const subscription = adapter.subscribe(listener);
		subscription.unsubscribe(); // Unsubscribe immediately

		adapter.send(counterSlice.actions.increment());
		expect(listener).toHaveBeenCalledTimes(1); // Should not trigger again after unsubscribe
	});

	it("should warn when subscribing after stop", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		adapter.stop(); // Stop adapter

		adapter.subscribe(() => {}); // Try to subscribe after stop

		expect(warnSpy).toHaveBeenCalledWith(
			"Adapter is stopped and cannot subscribe.",
		);

		warnSpy.mockRestore();
	});

	it("should allow unsubscribe calls after stop", () => {
		const listener = vi.fn();
		const subscription = adapter.subscribe(listener);

		adapter.stop();
		expect(() => subscription.unsubscribe()).not.toThrow(); // Should not throw error
	});
});

describe("ReduxAdapter with shared store", () => {
	let sharedStore: ReturnType<typeof counterStore>;
	type SharedState = InferStateAndEvent<
		ReturnType<typeof counterStore>
	>["State"];
	type SharedEvent = InferStateAndEvent<
		ReturnType<typeof counterStore>
	>["Event"];

	let adapterFactory: TestReduxAdapterFactory<
		SharedState,
		SharedEvent,
		ReduxStoreCommandActor<ReturnType<typeof counterStore>>
	>;
	let adapterA: IgniteAdapter<SharedState, SharedEvent>;
	let adapterB: IgniteAdapter<SharedState, SharedEvent>;

	beforeEach(() => {
		sharedStore = counterStore();
		adapterFactory = createReduxAdapter(sharedStore);
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

	it("reuses the same redux store instance", () => {
		adapterA.send(counterSlice.actions.increment());
		expect(adapterB.getState().counter.count).toBe(1);

		adapterB.send(counterSlice.actions.addByAmount(2));
		expect(adapterA.getState().counter.count).toBe(3);
	});

	it("exposes facade metadata for shared store adapters", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapterA);
		expect(snapshot.counter.count).toBe(0);
		const actor = adapterFactory.resolveCommandActor(adapterA);
		actor.dispatch(counterSlice.actions.increment());
		expect(adapterB.getState().counter.count).toBe(1);
	});
});

describe("ReduxAdapter error handling", () => {
	it("throws when a store factory does not return a redux store", () => {
		expect(() => {
			// @ts-expect-error - The factory does not produce a Redux store.
			const adapterFactory = createReduxAdapter(() => ({}));
			adapterFactory();
		}).toThrow(
			"[ReduxAdapter] store factory must return a Redux store instance.",
		);
	});
});
