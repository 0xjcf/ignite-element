import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import createReduxAdapter from "../../adapters/ReduxAdapter";

describe("ReduxAdapter", () => {
  // Define a slice using Redux Toolkit
  const counterSlice = createSlice({
    name: "counter",
    initialState: { count: 0 },
    reducers: {
      increment: (state) => {
        state.count += 1;
      },
      decrement: (state) => {
        state.count -= 1;
      },
      addByAmount: (state, action: PayloadAction<number>) => {
        state.count += action.payload;
      },
    },
  });

  const { actions, reducer } = counterSlice;

  // Create a fresh adapter instance before each test
  const configureAppStore = () =>
    configureStore({
      reducer,
    });

  let adapterFactory: ReturnType<typeof createReduxAdapter>;
  let adapter: ReturnType<typeof adapterFactory>;

  beforeEach(() => {
    adapterFactory = createReduxAdapter(configureAppStore);
    adapter = adapterFactory();
  });

  afterEach(() => {
    // Clean up adapter after each test
    adapter.stop();
    vi.clearAllMocks();
  });

  it("should initialize and return a valid adapter", () => {
    expect(adapter).toBeDefined();
    expect(adapter.getState()).toEqual({ count: 0 });
  });

  it("should allow subscribing to state changes", () => {
    const listener = vi.fn();
    const subscription = adapter.subscribe(listener);

    adapter.send(actions.increment());
    adapter.send(actions.decrement());

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 0 });

    subscription.unsubscribe();
  });

  it("should dispatch actions to the store", () => {
    adapter.send(actions.increment());
    expect(adapter.getState()).toEqual({ count: 1 });

    adapter.send(actions.addByAmount(5));
    expect(adapter.getState()).toEqual({ count: 6 });

    adapter.send(actions.decrement());
    expect(adapter.getState()).toEqual({ count: 5 });
  });

  it("should stop and clean up subscriptions", () => {
    const listener = vi.fn();
    const subscription = adapter.subscribe(listener);

    adapter.stop();
    adapter.send(actions.increment());

    expect(listener).not.toHaveBeenCalled();
    subscription.unsubscribe(); // Ensure no errors occur when unsubscribing
  });

  it("should unsubscribe properly", () => {
    const listener = vi.fn();
    const subscription = adapter.subscribe(listener);

    subscription.unsubscribe();

    adapter.send(actions.increment());
    expect(listener).not.toHaveBeenCalled();
  });
});
