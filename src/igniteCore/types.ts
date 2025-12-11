import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";
import type {
	ExtendedState,
	XStateActorInstance,
	XStateCommandActor,
} from "../adapters/XStateAdapter";
import type { WithFacadeRenderArgs } from "../createComponentFactory";
import type { ComponentFactory } from "../IgniteElementFactory";
import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../RenderArgs";
import type { InferStateAndEvent } from "../utils/igniteRedux";

export type AnyStatesCallback = FacadeStatesCallback<
	unknown,
	Record<string, unknown>
>;
export type AnyCommandsCallback = FacadeCommandsCallback<
	unknown,
	FacadeCommandResult,
	EventMap
>;

export type EventsDefinition<Events> = (event: EventBuilder) => Events;
export type AnyEventsDefinition = EventsDefinition<EventMap>;

export type InferEvents<Definition> = Definition extends EventsDefinition<
	infer Events
>
	? Events extends EventMap
		? Events
		: never
	: EmptyEventMap;

export type IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = unknown,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Events extends EventMap = EmptyEventMap,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		Events
	> &
		Record<never, Snapshot>
>;

export type ReduxBlueprintSource = Slice | (() => EnhancedStore);
export type ReduxInstanceSource = EnhancedStore;

export type ReduxCommandActorFor<Source> = Source extends Slice
	? ReduxSliceCommandActor<Source>
	: Source extends () => EnhancedStore
		? ReduxStoreCommandActor<ReturnType<Source>>
		: Source extends EnhancedStore
			? ReduxStoreCommandActor<Source>
			: never;

export type InferAdapterFromSource<Source> = Source extends AnyStateMachine
	? "xstate"
	: Source extends XStateActorInstance<AnyStateMachine>
		? "xstate"
		: Source extends () => infer Result
			? Result extends EnhancedStore
				? "redux"
				: Result extends object
					? "mobx"
					: never
			: Source extends EnhancedStore
				? "redux"
				: Source extends Slice
					? "redux"
					: Source extends object
						? "mobx"
						: never;

export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = {
	adapter?: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: FacadeStatesCallback<ExtendedState<Machine>, StatesResult>;
	commands?: FacadeCommandsCallback<
		XStateCommandActor<Machine>,
		CommandsResult,
		Events
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
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
		Events
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
		Events
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
> = {
	adapter?: "mobx";
	source: (() => State) | State;
	states?: FacadeStatesCallback<State, StatesResult>;
	commands?: FacadeCommandsCallback<State, CommandsResult, Events>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type IgniteCoreConfig =
	| {
			adapter?: "xstate";
			source: AnyStateMachine | XStateActorInstance<AnyStateMachine>;
			states?: unknown;
			commands?: unknown;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  }
	| {
			adapter?: "redux";
			source: Slice | EnhancedStore | (() => EnhancedStore);
			states?: unknown;
			commands?: unknown;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  }
	| {
			adapter?: "mobx";
			source: (() => object) | object;
			states?: unknown;
			commands?: unknown;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  };

export type ResolvedAdapter = "xstate" | "redux" | "mobx";
