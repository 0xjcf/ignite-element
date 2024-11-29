import igniteElementFactory, {
  IgniteElementConfig,
} from "./IgniteElmentFactory";
import createXStateAdapter from "./adapters/XStateAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createMobXAdapter from "./adapters/MobXAdapter";
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
      source: () => Store<any, Action<string>>;
      styles?: IgniteElementConfig["styles"];
    }
  | {
      adapter: "mobx";
      source: () => Record<string, any>;
      styles?: IgniteElementConfig["styles"];
    };

// Overload for XState
export function igniteCore<Machine extends AnyStateMachine>(options: {
  adapter: "xstate";
  source: Machine;
  styles?: IgniteElementConfig["styles"];
}): ReturnType<
  typeof igniteElementFactory<StateFrom<Machine>, EventFrom<Machine>>
>;

// Overload for Redux
export function igniteCore<State, Event extends Action<string>>(options: {
  adapter: "redux";
  source: () => Store<State, Event>;
  styles?: IgniteElementConfig["styles"];
}): ReturnType<typeof igniteElementFactory<State, Event>>;

// Overload for MobX
export function igniteCore<
  State extends Record<string, any>,
  Event extends { type: keyof State }
>(options: {
  adapter: "mobx";
  source: () => State;
  styles?: IgniteElementConfig["styles"];
}): ReturnType<typeof igniteElementFactory<State, Event>>;

// Unified implementation
export function igniteCore({
  adapter,
  source,
  styles,
}: IgniteCoreConfig): ReturnType<typeof igniteElementFactory<any, any>> {
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
