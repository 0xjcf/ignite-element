import igniteElementFactory, {
  IgniteCore,
  IgniteElementConfig,
} from "./IgniteElementFactory";
import createXStateAdapter from "./adapters/XStateAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createMobXAdapter, { FunctionKeys } from "./adapters/MobxAdapter";
import { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import {
  EnhancedStore,
  Slice,
  ActionCreatorWithoutPayload,
  ActionCreatorWithPayload,
} from "@reduxjs/toolkit";
import { InferStateAndEvent, InferEvent } from "./utils/igniteRedux";

// Extended Config Type
export type IgniteCoreConfig =
  | {
      adapter: "xstate";
      source: AnyStateMachine;
      styles?: IgniteElementConfig["styles"];
    }
  | {
      adapter: "redux";
      source: Slice; // Slice automatically infers actions
      styles?: IgniteElementConfig["styles"];
    }
  | {
      adapter: "redux";
      source: () => EnhancedStore; // Store requires explicit actions
      actions: Record<
        string,
        | ActionCreatorWithoutPayload<string>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | ActionCreatorWithPayload<any, string> // Allow dynamic payload inference for Redux actions
      >;
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

// Overload for Redux - Slice
export function igniteCore<
  SliceType extends Slice // Handles Slice with inferred actions
>(options: {
  adapter: "redux";
  source: SliceType;
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<
  InferStateAndEvent<SliceType>["State"], // Infer State from Slice
  InferStateAndEvent<SliceType>["Event"] // Infer Events from Slice
>;

// Overload for Redux - Store
export function igniteCore<
  StoreCreator extends () => EnhancedStore,
  Actions extends Record<
    string,
    | ActionCreatorWithoutPayload<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ActionCreatorWithPayload<any, string> // Allow dynamic payload inference for Redux actions
  >
>(options: {
  adapter: "redux";
  source: StoreCreator;
  actions: Actions; // Pass actions explicitly
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<
  ReturnType<ReturnType<StoreCreator>["getState"]>, // Infer State from Store
  InferEvent<Actions> // Infer Events from explicit actions
>;

// Overload for MobX
export function igniteCore<
  State extends Record<string, unknown>,
  Event extends { type: FunctionKeys<State> }
>(options: {
  adapter: "mobx";
  source: () => State;
  styles?: IgniteElementConfig["styles"];
}): IgniteCore<State, Event>;

// Unified Implementation
export function igniteCore({ adapter, source, styles }: IgniteCoreConfig) {
  let adapterFactory;

  switch (adapter) {
    case "xstate":
      adapterFactory = createXStateAdapter(source);
      break;

    case "redux":
      // For Redux, delegate store or slice logic to ReduxAdapter
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
