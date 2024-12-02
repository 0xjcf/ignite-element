import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMachine } from "xstate";
import createXStateAdapter from "../../adapters/XStateAdapter";

describe("XStateAdapter", () => {
  // Default state machine setup for each test
  const machine = createMachine({
    id: "test",
    initial: "idle",
    states: {
      idle: { on: { START: "active" } },
      active: { on: { RESET: "idle" } },
    },
  });

  let adapterFactory: ReturnType<typeof createXStateAdapter>;
  let adapter: ReturnType<typeof adapterFactory>;

  beforeEach(() => {
    adapterFactory = createXStateAdapter(machine);
    adapter = adapterFactory();
  });

  afterEach(() => {
    // Cleanup after each test
    adapter.stop();
    vi.clearAllMocks();
  });

  it("should initialize and start the actor without errors", () => {
    expect(adapter).toBeDefined();
    expect(adapter.getState().value).toBe("idle");
  });

  it("should allow subscription to state changes", () => {
    const listener = vi.fn();
    const subscription = adapter.subscribe(listener);

    adapter.send({ type: "START" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ value: "active" })
    );

    subscription.unsubscribe();
  });

  it("should stop the actor and cleanup subscriptions", () => {
    const listener = vi.fn();
    const subscription = adapter.subscribe(listener);

    adapter.stop();

    // Ensure no further notifications are sent
    adapter.send({ type: "RESET" });

    expect(listener).not.toHaveBeenCalled();

    // Cleanup subscription explicitly (no-op since actor is stopped)
    subscription.unsubscribe();
  });

  it("should send events to the actor", () => {
    adapter.send({ type: "START" });

    expect(adapter.getState().value).toBe("active");

    adapter.send({ type: "RESET" });

    expect(adapter.getState().value).toBe("idle");
  });

  it("should handle multiple subscriptions correctly", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const subscription1 = adapter.subscribe(listener1);
    const subscription2 = adapter.subscribe(listener2);

    adapter.send({ type: "START" });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith(
      expect.objectContaining({ value: "active" })
    );
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledWith(
      expect.objectContaining({ value: "active" })
    );

    subscription1.unsubscribe();
    subscription2.unsubscribe();
  });
});
