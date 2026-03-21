import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "ignite-core";
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

export type ReduxBlueprintConfig<
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
		Events,
		Host
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
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
		Events,
		Host
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
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
> = {
	adapter?: "mobx";
	source: (() => State) | State;
	states?: FacadeStatesCallback<State, StatesResult>;
	commands?: FacadeCommandsCallback<State, CommandsResult, Events, Host>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type { MobxEvent };
