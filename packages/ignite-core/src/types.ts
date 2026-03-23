import type { AnyStateMachine } from "xstate";
import type {
	ExtendedState,
	XStateActorInstance,
	XStateCommandActor,
} from "./adapters/XStateAdapter";
import type {
	ProjectionFactory,
	WithFacadeRenderArgs,
} from "./createProjectionFactory";
import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeEffectsCallback,
	FacadeEffectsLike,
	FacadeEffectsObjectCallback,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	FacadeViewCallback,
} from "./RenderArgs";

export type AnyStatesCallback = FacadeStatesCallback<
	unknown,
	Record<string, unknown>
>;
export type AnyViewCallback = FacadeViewCallback<
	unknown,
	Record<string, unknown>
>;
export type AnyCommandsCallback = FacadeCommandsCallback<
	unknown,
	FacadeCommandResult
>;
export type AnyEffectsCallback = FacadeEffectsLike<unknown, unknown, EventMap>;

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
	Host = unknown,
> = ProjectionFactory<
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
	>,
	Host,
	Events
> &
	Record<never, Snapshot>;

type XStateConfigBase<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: FacadeStatesCallback<ExtendedState<Machine>, StatesResult>;
	view?: FacadeViewCallback<ExtendedState<Machine>, StatesResult>;
	commands?: FacadeCommandsCallback<
		XStateCommandActor<Machine>,
		CommandsResult,
		Host
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type XStateEffectsOptions<
	Machine extends AnyStateMachine,
	Events extends EventMap,
	Host,
> =
	| {
			effects?: FacadeEffectsCallback<
				ExtendedState<Machine>,
				XStateCommandActor<Machine>,
				Events,
				Host
			>;
	  }
	| {
			effects?: FacadeEffectsObjectCallback<
				ExtendedState<Machine>,
				XStateCommandActor<Machine>,
				Events,
				Host
			>;
	  };

export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = XStateConfigBase<Machine, Events, StatesResult, CommandsResult, Host> &
	XStateEffectsOptions<Machine, Events, Host>;
