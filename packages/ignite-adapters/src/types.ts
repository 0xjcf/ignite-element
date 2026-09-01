import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type { InferStateAndEvent } from "./utils/igniteRedux";

export type ReduxSliceCommandActor<SliceType extends Slice> = {
	dispatch: (event: InferStateAndEvent<SliceType>["Event"]) => void;
	getState: () => InferStateAndEvent<SliceType>["State"];
	subscribe: (listener: () => void) => () => void;
};

export type ReduxStoreCommandActor<StoreInstance extends EnhancedStore> = {
	dispatch: (event: InferStateAndEvent<StoreInstance>["Event"]) => void;
	getState: () => InferStateAndEvent<StoreInstance>["State"];
	subscribe: StoreInstance["subscribe"];
};

export type ReduxBlueprintSource = Slice | (() => EnhancedStore);
export type ReduxInstanceSource = EnhancedStore;

export type ReduxCommandActorFor<Source> = Source extends Slice
	? ReduxSliceCommandActor<Source>
	: Source extends () => EnhancedStore
		? ReduxStoreCommandActor<ReturnType<Source>>
		: Source extends EnhancedStore
			? ReduxStoreCommandActor<Source>
			: never;

type ReduxBlueprintBaseConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "redux";
	source: Source;
	states?: FacadeStatesCallback<
		InferStateAndEvent<Source>["State"],
		StatesResult
	>;
	commands?: FacadeCommandsCallback<
		ReduxCommandActorFor<Source>,
		CommandsResult,
		Host,
		InferStateAndEvent<Source>["State"]
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type ReduxBlueprintEffectsConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap,
> = {
	effects?: FacadeEffectsObjectCallback<
		InferStateAndEvent<Source>["State"],
		ReduxCommandActorFor<Source>,
		Events
	>;
};

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = ReduxBlueprintBaseConfig<
	Source,
	Events,
	StatesResult,
	CommandsResult,
	Host
> &
	ReduxBlueprintEffectsConfig<Source, Events>;

type ReduxInstanceBaseConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "redux";
	source: StoreInstance;
	states?: FacadeStatesCallback<
		InferStateAndEvent<StoreInstance>["State"],
		StatesResult
	>;
	commands?: FacadeCommandsCallback<
		ReduxCommandActorFor<StoreInstance>,
		CommandsResult,
		Host,
		InferStateAndEvent<StoreInstance>["State"]
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type ReduxInstanceEffectsConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap,
> = {
	effects?: FacadeEffectsObjectCallback<
		InferStateAndEvent<StoreInstance>["State"],
		ReduxCommandActorFor<StoreInstance>,
		Events
	>;
};

export type ReduxInstanceConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = ReduxInstanceBaseConfig<
	StoreInstance,
	Events,
	StatesResult,
	CommandsResult,
	Host
> &
	ReduxInstanceEffectsConfig<StoreInstance, Events>;

type MobxBaseConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "mobx";
	source: (() => State) | State;
	states?: FacadeStatesCallback<State, StatesResult>;
	commands?: FacadeCommandsCallback<State, CommandsResult, Host, State>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type MobxEffectsConfig<State extends object, Events extends EventMap, Host> = {
	effects?: FacadeEffectsObjectCallback<State, State, Events, Host>;
};

export type MobxConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = MobxBaseConfig<State, Events, StatesResult, CommandsResult, Host> &
	MobxEffectsConfig<State, Events, Host>;

export type { MobxEvent };
