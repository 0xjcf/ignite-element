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
    adapter.stop();
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
    adapter.stop();
    vi.clearAllMocks();
  });

  it("should initialize and return the current state", () => {
    expect(adapter).toBeDefined();
    expect(adapter.getState()).toEqual({ counter: { count: 0 } });
  });

  it("should dispatch actions and update state", () => {
    adapter.send(counterSlice.actions.increment()); // ✅ Valid
    expect(adapter.getState()).toEqual({ counter: { count: 1 } });

    adapter.send(counterSlice.actions.addByAmount(5)); // ✅ Valid
    expect(adapter.getState()).toEqual({ counter: { count: 6 } });

    adapter.send(counterSlice.actions.decrement()); // ✅ Valid
    expect(adapter.getState()).toEqual({ counter: { count: 5 } });
  });

  it("should prevent invalid actions", () => {
    // @ts-expect-error Invalid action type
    adapter.send({ type: "counter/unknownAction" }); // ❌ Should throw compile-time error
    expect(adapter.getState()).toEqual({ counter: { count: 0 } }); // No state change
  });
});
