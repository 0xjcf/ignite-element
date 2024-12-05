import igniteElementFactory, {
  IgniteCore,
  IgniteElementConfig,
} from "./IgniteElmentFactory";
import createXStateAdapter from "./adapters/XStateAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createMobXAdapter, { FunctionKeys } from "./adapters/MobxAdapter";
import { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { Store, Action } from "redux";

// Extended config type to include `styles`
export type IgniteCoreConfig =
  | {
      adapter: "xstate";
      source: AnyStateMachine;
      styles?: IgniteElementConfig["styles"];
    }
  | {
      adapter: "redux";
      source: () => Store<unknown, Action<string>>;
      styles?: IgniteElementConfig["styles"];
    }
  | {
      adapter: "mobx";
      source: () => Record<string, unknown>;
      styles?: IgniteElementConfig["styles"];
    };

// Overload for XState
export function igniteCore<Machine extends AnyStateMachine>(options: {
  adapter: "xstate";
  source: Machine;
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<StateFrom<Machine>, EventFrom<Machine>>;

// Overload for Redux
export function igniteCore<State, Event extends Action<string>>(options: {
  adapter: "redux";
  source: () => Store<State, Event>;
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<State, Event>;

// Overload for MobX
export function igniteCore<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  State extends Record<string, any>,
  Event extends { type: FunctionKeys<State> }
>(options: {
  adapter: "mobx";
  source: () => State;
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<State, Event>;

// Unified implementation
export function igniteCore({ adapter, source, styles }: IgniteCoreConfig) {
  let adapterFactory;

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

  return igniteElementFactory(adapterFactory, { styles });
}
