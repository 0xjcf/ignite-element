import igniteElementFactory from "./IgniteElmentFactory";
import createXStateAdapter from "./adapters/XStateAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createMobXAdapter from "./adapters/MobXAdapter";
import { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { Store, Action } from "redux";

export type IgniteCoreConfig =
  | { adapter: "xstate"; source: AnyStateMachine }
  | { adapter: "redux"; source: () => Store<any, Action<string>> }
  | { adapter: "mobx"; source: () => Record<string, any> };

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
export function igniteCore({ adapter, source }: IgniteCoreConfig) {
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

  return igniteElementFactory(adapterFactory);
}
