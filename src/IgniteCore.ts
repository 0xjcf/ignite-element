import igniteElementFactory from "./IgniteElmentFactory";
import createXStateAdapter from "./adapters/XStateAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createMobXAdapter from "./adapters/MobXAdapter";
import { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { Store, Action } from "redux";

export function igniteCore<Machine extends AnyStateMachine>(
  adapter: "xstate",
  source: Machine
): ReturnType<
  typeof igniteElementFactory<StateFrom<Machine>, EventFrom<Machine>>
>;

export function igniteCore<State, Event extends Action<string>>(
  adapter: "redux",
  source: () => Store<State, Event>
): ReturnType<typeof igniteElementFactory<State, Event>>;

export function igniteCore<
  State extends Record<string, any>,
  Event extends { type: keyof State }
>(
  adapter: "mobx",
  source: State
): ReturnType<typeof igniteElementFactory<State, Event>>;

// options
export function igniteCore<Machine extends AnyStateMachine>(options: {
  adapter: "xstate";
  source: Machine;
}): ReturnType<
  typeof igniteElementFactory<StateFrom<Machine>, EventFrom<Machine>>
>;

export function igniteCore<State, Event extends Action<string>>(options: {
  adapter: "redux";
  source: () => Store<State, Event>;
}): ReturnType<typeof igniteElementFactory<State, Event>>;

export function igniteCore<
  State extends Record<string, any>,
  Event extends { type: keyof State }
>(options: {
  adapter: "mobx";
  source: () => State;
}): ReturnType<typeof igniteElementFactory<State, Event>>;

// Unified implementation
export function igniteCore(
  arg1:
    | "xstate"
    | "redux"
    | "mobx"
    | { adapter: "xstate"; source: AnyStateMachine }
    | { adapter: "redux"; source: () => Store<any, Action<string>> }
    | { adapter: "mobx"; source: () => Record<string, any> },
  arg2?:
    | AnyStateMachine
    | (() => Store<any, Action<string>>)
    | (() => Record<string, any>)
) {
  let adapterFactory;

  // Handle object-based configuration
  if (typeof arg1 === "object" && "adapter" in arg1) {
    const { adapter, source } = arg1;
    switch (adapter) {
      case "xstate":
        adapterFactory = createXStateAdapter(source);
        break;
      case "redux":
        adapterFactory = createReduxAdapter(source);
        break;
      case "mobx":
        adapterFactory = createMobXAdapter(source);
        break;
      default:
        throw new Error(`Unsupported adapter: ${adapter}`);
    }
  }
  // Handle separate arguments
  else if (typeof arg1 === "string" && arg2) {
    switch (arg1) {
      case "xstate":
        adapterFactory = createXStateAdapter(arg2 as AnyStateMachine);
        break;
      case "redux":
        adapterFactory = createReduxAdapter(
          arg2 as () => Store<any, Action<string>>
        );
        break;
      case "mobx":
        adapterFactory = createMobXAdapter(arg2 as () => Record<string, any>);
        break;
      default:
        throw new Error(`Unsupported adapter: ${arg1}`);
    }
  } else {
    throw new Error("Invalid arguments for igniteCore");
  }

  return igniteElementFactory(adapterFactory);
}
