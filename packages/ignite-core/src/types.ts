import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "./RenderArgs";

export type AnyStatesCallback = FacadeStatesCallback<
	unknown,
	Record<string, unknown>
>;
export type AnyCommandsCallback = FacadeCommandsCallback<
	unknown,
	FacadeCommandResult
>;
export type AnyEffectsCallback = FacadeEffectsObjectCallback<
	unknown,
	unknown,
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
