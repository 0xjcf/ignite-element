import { AnyStateMachine } from "xstate";
import { igniteCore } from "../IgniteCore";

describe("igniteCore", () => {
  it("should initialize without errors", () => {
    const core = igniteCore({
      adapter: "xstate",
      source: {} as AnyStateMachine,
    });
    expect(core).toBeDefined();
  });

  it("should throw an error for unsupported adapters", () => {
    expect(() =>
      igniteCore({
        // @ts-expect-error
        adapter: "unsupported",
        source: {} as AnyStateMachine,
      })
    ).toThrow();
  });
});
