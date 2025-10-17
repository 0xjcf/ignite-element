import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom } from "xstate";
import createMobXAdapter, { type MobxEvent } from "./adapters/MobxAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
} from "./adapters/XStateAdapter";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteElementConfig,
} from "./IgniteElementFactory";
import type { InferStateAndEvent, ReduxActions } from "./utils/igniteRedux";

// Extended Config Type

export type IgniteCoreConfig =
	| {
			adapter: "xstate";
			source: AnyStateMachine | XStateActorInstance<AnyStateMachine>;
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
			adapter: "redux";
			source: EnhancedStore;
			actions: ReduxActions;
			styles?: IgniteElementConfig["styles"];
	  }
	| {
			adapter: "mobx";
			source: () => Record<string, unknown>;
			styles?: IgniteElementConfig["styles"];
	  }
	| {
			adapter: "mobx";
			source: Record<string, unknown>;
			styles?: IgniteElementConfig["styles"];
	  };

// Overload for XState
export function igniteCore<Machine extends AnyStateMachine>(options: {
	adapter: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	styles?: IgniteElementConfig["styles"];
}): ComponentFactory<ExtendedState<Machine>, EventFrom<Machine>>;

// Overload for Redux - Slice
export function igniteCore<
	SliceType extends Slice, // Handles Slice with inferred actions
>(options: {
	adapter: "redux";
	source: SliceType;
	styles?: IgniteElementConfig["styles"];
}): ComponentFactory<
	InferStateAndEvent<SliceType>["State"],
	InferStateAndEvent<SliceType>["Event"]
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
}): ComponentFactory<
	InferStateAndEvent<StoreCreator, Actions>["State"],
	InferStateAndEvent<StoreCreator, Actions>["Event"]
>;
export function igniteCore<
	StoreInstance extends EnhancedStore,
	Actions extends ReduxActions,
>(options: {
	adapter: "redux";
	source: StoreInstance;
	actions: Actions;
	styles?: IgniteElementConfig["styles"];
}): ComponentFactory<
	InferStateAndEvent<StoreInstance, Actions>["State"],
	InferStateAndEvent<StoreInstance, Actions>["Event"]
>;

// Overload for MobX
export function igniteCore<State extends object>(options: {
	adapter: "mobx";
	source: (() => State) | State;
	styles?: IgniteElementConfig["styles"];
}): ComponentFactory<State, MobxEvent<State>>;

// Unified Implementation
export function igniteCore(options: IgniteCoreConfig) {
	const adapterName = options.adapter;

	switch (adapterName) {
		case "xstate": {
			const adapterFactory = createXStateAdapter(options.source);
			return igniteElementFactory(
				adapterFactory,
				{ styles: options.styles },
				{
					scope: adapterFactory.scope,
				},
			);
		}

		case "redux": {
			if ("actions" in options) {
				const { source, actions } = options;
				const adapterFactory = createReduxAdapter(source, actions);
				return igniteElementFactory(
					adapterFactory,
					{ styles: options.styles },
					{
						scope: adapterFactory.scope,
					},
				);
			}

			const adapterFactory = createReduxAdapter(options.source);
			return igniteElementFactory(
				adapterFactory,
				{ styles: options.styles },
				{
					scope: adapterFactory.scope,
				},
			);
		}

		case "mobx": {
			const adapterFactory = createMobXAdapter(options.source);
			return igniteElementFactory(
				adapterFactory,
				{ styles: options.styles },
				{
					scope: adapterFactory.scope,
				},
			);
		}

		default: {
			return assertNever(options, adapterName);
		}
	}
}

function assertNever(_options: never, adapter: string): never {
	throw new Error(`Unsupported adapter: ${adapter}`);
}
