import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom } from "xstate";
import createMobXAdapter, { type FunctionKeys } from "./adapters/MobxAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createXStateAdapter, {
	type ExtendedState,
} from "./adapters/XStateAdapter";
import igniteElementFactory, {
	type IgniteCore,
	type IgniteElementConfig,
} from "./IgniteElementFactory";
import type { InferStateAndEvent, ReduxActions } from "./utils/igniteRedux";

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
			source: () => EnhancedStore;
			actions: ReduxActions;
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
}): IgniteCore<ExtendedState<Machine>, EventFrom<Machine>>;

// Overload for Redux - Slice
export function igniteCore<
	SliceType extends Slice, // Handles Slice with inferred actions
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
	Actions extends ReduxActions,
>(options: {
	adapter: "redux";
	source: StoreCreator;
	actions: Actions; // Pass actions explicitly
	styles?: IgniteElementConfig["styles"];
}): IgniteCore<
	InferStateAndEvent<StoreCreator, Actions>["State"], // Infer State from Store
	InferStateAndEvent<StoreCreator, Actions>["Event"] // Infer Events from explicit actions
>;

// Overload for MobX
export function igniteCore<
	State extends object,
	Event extends { type: FunctionKeys<State> },
>(options: {
	adapter: "mobx";
	source: () => State;
	styles?: IgniteElementConfig["styles"];
}): IgniteCore<State, Event>;

// Unified Implementation
export function igniteCore(options: IgniteCoreConfig) {
	const adapterName = options.adapter;

	switch (adapterName) {
		case "xstate": {
			const igniteAdapter = createXStateAdapter(options.source);
			return igniteElementFactory(igniteAdapter, { styles: options.styles });
		}

		case "redux": {
			if ("actions" in options) {
				const igniteAdapter = createReduxAdapter(
					options.source,
					options.actions,
				);
				return igniteElementFactory(igniteAdapter, { styles: options.styles });
			}

			const igniteAdapter = createReduxAdapter(options.source);
			return igniteElementFactory(igniteAdapter, { styles: options.styles });
		}

		case "mobx": {
			const igniteAdapter = createMobXAdapter(options.source);
			return igniteElementFactory(igniteAdapter, { styles: options.styles });
		}

		default: {
			return assertNever(options, adapterName);
		}
	}
}

function assertNever(_options: never, adapter: string): never {
	throw new Error(`Unsupported adapter: ${adapter}`);
}
