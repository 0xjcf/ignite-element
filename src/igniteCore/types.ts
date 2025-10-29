import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";
import type {
	ExtendedState,
	XStateActorInstance,
} from "../adapters/XStateAdapter";
import type { WithFacadeRenderArgs } from "../createComponentFactory";
import type { ComponentFactory } from "../IgniteElementFactory";
import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
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

export type EventsDefinition<Events extends EventMap> = (
	event: EventBuilder,
) => Events;

export type AnyEventsDefinition = EventsDefinition<EventMap>;

export type IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StateCallback extends
		| FacadeStatesCallback<Snapshot, Record<string, unknown>>
		| undefined,
	CommandActor,
	CommandCallback extends
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult, EventMap>
		| undefined,
	Events extends EventMap = EmptyEventMap,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
		Record<never, never>,
		Events
	>
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
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				XStateActorInstance<Machine>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
> = {
	adapter?: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: StateCallback;
	commands?: CommandCallback;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<Source>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
> = {
	adapter?: "redux";
	source: Source;
	states?: StateCallback;
	commands?: CommandCallback;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type ReduxInstanceConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<StoreInstance>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
> = {
	adapter?: "redux";
	source: StoreInstance;
	states?: StateCallback;
	commands?: CommandCallback;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type MobxConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult, Events>
		| undefined = undefined,
> = {
	adapter?: "mobx";
	source: (() => State) | State;
	states?: StateCallback;
	commands?: CommandCallback;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

export type IgniteCoreConfig =
	| {
			adapter?: "xstate";
			source: AnyStateMachine | XStateActorInstance<AnyStateMachine>;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  }
	| {
			adapter?: "redux";
			source: Slice | EnhancedStore | (() => EnhancedStore);
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  }
	| {
			adapter?: "mobx";
			source: (() => object) | object;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			events?: AnyEventsDefinition;
			cleanup?: boolean;
	  };

export type ResolvedAdapter = "xstate" | "redux" | "mobx";
