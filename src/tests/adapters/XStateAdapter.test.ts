import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import createXStateAdapter from "../../adapters/XStateAdapter";
import counterMachine from "../../examples/xstate/xstateCounterMachine";

describe("XStateAdapter", () => {
  let adapterFactory: ReturnType<typeof createXStateAdapter>;
  let adapter: ReturnType<typeof adapterFactory>;

  beforeEach(() => {
    adapterFactory = createXStateAdapter(counterMachine);
    adapter = adapterFactory();
  });

  afterEach(() => {
    adapter.stop();
    vi.clearAllMocks();
  });

  it("should initialize and return the current state", () => {
    expect(adapter).toBeDefined();
    expect(adapter.getState().value).toBe("idle");
    expect(adapter.getState().context.count).toBe(0);
  });

  it("should dispatch events and update state", () => {
    adapter.send({ type: "START" });
    expect(adapter.getState().value).toBe("active");

    adapter.send({ type: "INC" });
    expect(adapter.getState().context.count).toBe(1);

    adapter.send({ type: "DEC" });
    expect(adapter.getState().context.count).toBe(0);
  });

  it("should handle multiple subscriptions and notify listeners", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    adapter.subscribe(listener1);
    adapter.subscribe(listener2);

    adapter.send({ type: "START" });

    expect(listener1).toHaveBeenCalledTimes(2);
    expect(listener1).toHaveBeenCalledWith(
      expect.objectContaining({ value: "idle" }) // Initial state
    );
    expect(listener1).toHaveBeenCalledWith(
      expect.objectContaining({ value: "active" }) // After START
    );

    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener2).toHaveBeenCalledWith(
      expect.objectContaining({ value: "idle" }) // Initial state
    );
    expect(listener2).toHaveBeenCalledWith(
      expect.objectContaining({ value: "active" }) // After START
    );
  });

  it("should clean up subscriptions when stopped", () => {
    const consoleErrorMock = vi.spyOn(console, "warn").mockImplementation(() => {});
  
    const listener = vi.fn();
    adapter.subscribe(listener);
    adapter.stop();
    adapter.send({ type: "INC" });
  
    // Listener should only have been called once (for the initial state)
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ value: "idle" }) // Ensure correct initial state
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("Cannot send events when adapter is stopped")
    );
  
    consoleErrorMock.mockRestore(); // Restore original console.error
  });
  

  it("should log a warning when sending events after stop", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    adapter.stop();
    adapter.send({ type: "INC" });

    expect(warnSpy).toHaveBeenCalledWith(
      "[XStateAdapter] Cannot send events when adapter is stopped."
    );

    warnSpy.mockRestore();
  });

  it("should return the last known state after stop", () => {
    adapter.send({ type: "START" });
    adapter.stop();

    expect(adapter.getState().value).toBe("active");
    expect(adapter.getState().context.count).toBe(0);
  });

  it("should prevent new subscriptions after stop", () => {
    adapter.stop();
    expect(() => adapter.subscribe(vi.fn())).toThrowError(
      "Adapter is stopped and cannot subscribe."
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
});
