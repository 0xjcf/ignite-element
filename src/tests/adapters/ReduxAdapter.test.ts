import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import createReduxAdapter from "../../adapters/ReduxAdapter";
import counterStore, {
  counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import IgniteAdapter from "../../IgniteAdapter";
import { InferStateAndEvent } from "../../utils/igniteRedux";

/**
 * Tests for Slice Source
 */
describe("ReduxAdapter with Slice Source", () => {
  // Infer types from Slice
  type IgniteRedux = InferStateAndEvent<typeof counterSlice>;

  type State = IgniteRedux["State"];
  type Event = IgniteRedux["Event"];

  let adapterFactory: () => IgniteAdapter<State, Event>;
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
});

/**
 * Tests for Store Source
 */
describe("ReduxAdapter with Store Source", () => {
  // Infer types from Store and explicitly pass actions
  type IgniteRedux = InferStateAndEvent<
    typeof counterStore,
    typeof counterSlice.actions // Explicit actions for store
  >;

  type State = IgniteRedux["State"];
  type Event = IgniteRedux["Event"];

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
    // @ts-expect-error Invalid action type
    adapter.send({ type: "counter/unknownAction" });
    expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // No state change
  });

  it("should prevent actions after adapter is stopped", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    adapter.stop(); // Stop adapter
    adapter.send(counterSlice.actions.increment());

    expect(warnSpy).toHaveBeenCalledWith(
      "[ReduxAdapter] Cannot send events when adapter is stopped."
    );

    expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // State should not change
    warnSpy.mockRestore();
  });
});

/**
 * Tests for Subscribe Method
 */
describe("ReduxAdapter - Subscribe Method", () => {
  let adapterFactory: () => IgniteAdapter<any, any>;
  let adapter: IgniteAdapter<any, any>;

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
      "Adapter is stopped and cannot subscribe."
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
