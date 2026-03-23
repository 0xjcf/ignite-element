import type {
	ProjectionFactory,
	WithFacadeRenderArgs,
} from "./createProjectionFactory";
import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeEffectsLike,
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
