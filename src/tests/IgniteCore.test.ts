import { describe, it, expect } from "vitest";
import { igniteCore } from "../IgniteCore";
import { Store, Action } from "@reduxjs/toolkit";
import { AnyStateMachine } from "xstate";

// Mock XState machine
const mockXStateMachine = {} as AnyStateMachine;
// Mock Redux store
const mockReduxStore = {} as () => Store<unknown, Action<string>>;
// Mock Mobx store
const mockMobxStore = {} as () => Record<string, unknown>;

describe("igniteCore", () => {
  it("should initialize without errors for XState adapter", () => {
    const core = igniteCore({
      adapter: "xstate",
      source: mockXStateMachine,
    });
    expect(core).toBeDefined();
  });

  it("should initialize without errors for Redux adapter", () => {
    const core = igniteCore({
      adapter: "redux",
      source: mockReduxStore,
    });
    expect(core).toBeDefined();
  });

  it("should initialize without errors for Mobx adapter", () => {
    const core = igniteCore({
      adapter: "mobx",
      source: mockMobxStore,
    });
    expect(core).toBeDefined();
  });

  it("should throw an error for unsupported adapters", () => {
    expect(() =>
      igniteCore({
        // @ts-expect-error This error is expected because `unknownAction` is not part of the defined event types.
        adapter: "unsupported",
        source: mockXStateMachine,
      })
    ).toThrow("Unsupported adapter: unsupported");
  });
});
