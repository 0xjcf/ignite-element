import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom } from "xstate";
import createMobXAdapter, { type MobxEvent } from "./adapters/MobxAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
} from "./adapters/XStateAdapter";
import {
	createComponentFactory,
	type WithFacadeRenderArgs,
} from "./createComponentFactory";
import type { ComponentFactory } from "./IgniteElementFactory";
import type {
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "./RenderArgs";
import { isReduxStore } from "./utils/adapterGuards";
import type { InferStateAndEvent } from "./utils/igniteRedux";

type AnyStatesCallback = FacadeStatesCallback<unknown, Record<string, unknown>>;
type AnyCommandsCallback = FacadeCommandsCallback<unknown, FacadeCommandResult>;

type IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StateCallback extends
		| FacadeStatesCallback<Snapshot, Record<string, unknown>>
		| undefined,
	CommandActor,
	CommandCallback extends
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult>
		| undefined,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback
	>
>;

type XStateConfig<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined,
> = {
	adapter: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: StateCallback;
	commands?: CommandCallback;
};

type ReduxSliceConfig<
	SliceType extends Slice,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<SliceType>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxSliceCommandActor<SliceType>,
				FacadeCommandResult
		  >
		| undefined,
> = {
	adapter: "redux";
	source: SliceType;
	states?: StateCallback;
	commands?: CommandCallback;
};

type ReduxStoreFactoryConfig<
	StoreCreator extends () => EnhancedStore,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreCreator>["State"],
			Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxStoreCommandActor<ReturnType<StoreCreator>>,
			FacadeCommandResult
		  >
		| undefined,
> = {
	adapter: "redux";
	source: StoreCreator;
	states?: StateCallback;
	commands?: CommandCallback;
};

type ReduxStoreInstanceConfig<
	StoreInstance extends EnhancedStore,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
			Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxStoreCommandActor<StoreInstance>,
			FacadeCommandResult
		  >
		| undefined,
> = {
	adapter: "redux";
	source: StoreInstance;
	states?: StateCallback;
	commands?: CommandCallback;
};

type MobxConfig<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined,
> = {
	adapter: "mobx";
	source: (() => State) | State;
	states?: StateCallback;
	commands?: CommandCallback;
};

export type IgniteCoreConfig =
	| {
			adapter: "xstate";
			source: AnyStateMachine | XStateActorInstance<AnyStateMachine>;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
	  }
	| {
		adapter: "redux";
		source: Slice | EnhancedStore | (() => EnhancedStore);
		states?: AnyStatesCallback;
		commands?: AnyCommandsCallback;
	}
	| {
			adapter: "mobx";
			source: (() => object) | object;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
	  };

// Overload for XState
export function igniteCore<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined = undefined,
>(
	options: XStateConfig<Machine, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StateCallback,
	XStateActorInstance<Machine>,
	CommandCallback
>;

// Overload for Redux - Slice
export function igniteCore<
	SliceType extends Slice,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<SliceType>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxSliceCommandActor<SliceType>,
				FacadeCommandResult
		  >
		| undefined = undefined,
>(
	options: ReduxSliceConfig<SliceType, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<SliceType>["State"],
	InferStateAndEvent<SliceType>["Event"],
	InferStateAndEvent<SliceType>["State"],
	StateCallback,
	ReduxSliceCommandActor<SliceType>,
	CommandCallback
>;

// Overload for Redux - Store factory
export function igniteCore<
	StoreCreator extends () => EnhancedStore,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreCreator>["State"],
			Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxStoreCommandActor<ReturnType<StoreCreator>>,
			FacadeCommandResult
		  >
		| undefined = undefined,
>(
	options: ReduxStoreFactoryConfig<
		StoreCreator,
		StateCallback,
		CommandCallback
	>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreCreator>["State"],
	InferStateAndEvent<StoreCreator>["Event"],
	InferStateAndEvent<StoreCreator>["State"],
	StateCallback,
	ReduxStoreCommandActor<ReturnType<StoreCreator>>,
	CommandCallback
>;

// Overload for Redux - Store instance
export function igniteCore<
	StoreInstance extends EnhancedStore,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
			Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxStoreCommandActor<StoreInstance>,
			FacadeCommandResult
		  >
		| undefined = undefined,
>(
	options: ReduxStoreInstanceConfig<
		StoreInstance,
		StateCallback,
		CommandCallback
	>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StateCallback,
	ReduxStoreCommandActor<StoreInstance>,
	CommandCallback
>;

// Overload for MobX
export function igniteCore<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined = undefined,
>(
	options: MobxConfig<State, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StateCallback,
	State,
	CommandCallback
>;

// Unified Implementation
export function igniteCore(options: IgniteCoreConfig) {
	const adapterName = options.adapter;

	switch (adapterName) {
		case "xstate": {
			const adapterFactory = createXStateAdapter(options.source);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
			});
		}

	case "redux": {
		const source = options.source;
		if (typeof source === "function" && !isReduxStore(source)) {
			const adapterFactory = createReduxAdapter(
				source as () => EnhancedStore,
			);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
			});
		}

		if (isReduxStore(source)) {
			const adapterFactory = createReduxAdapter(source as EnhancedStore);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
			});
		}

		const adapterFactory = createReduxAdapter(source as Slice);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
		});
	}

		case "mobx": {
			const adapterFactory = createMobXAdapter(options.source);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
			});
		}

		default: {
			return assertNever(options, adapterName);
		}
	}
}

function assertNever(_options: never, adapter: string): never {
	throw new Error(`Unsupported adapter: ${adapter}`);
}
