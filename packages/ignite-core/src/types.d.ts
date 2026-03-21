import type { AnyStateMachine } from "xstate";
import type { ExtendedState, XStateActorInstance, XStateCommandActor } from "./adapters/XStateAdapter";
import type { ProjectionFactory, WithFacadeRenderArgs } from "./createProjectionFactory";
import type { EmptyEventMap, EventBuilder, EventMap, FacadeCommandFunction, FacadeCommandResult, FacadeCommandsCallback, FacadeStatesCallback } from "./RenderArgs";
export type AnyStatesCallback = FacadeStatesCallback<unknown, Record<string, unknown>>;
export type AnyCommandsCallback = FacadeCommandsCallback<unknown, FacadeCommandResult>;
export type EventsDefinition<Events> = (event: EventBuilder) => Events;
export type AnyEventsDefinition = EventsDefinition<EventMap>;
export type InferEvents<Definition> = Definition extends EventsDefinition<infer Events> ? Events extends EventMap ? Events : never : EmptyEventMap;
export type IgniteCoreReturn<State, Event, Snapshot, StatesResult extends Record<string, unknown> = Record<never, never>, CommandActor = unknown, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Events extends EventMap = EmptyEventMap, Host = unknown> = ProjectionFactory<State, Event, WithFacadeRenderArgs<State, Event, StatesResult, CommandActor, CommandsResult, Record<never, never>, Events>, Host, Events> & Record<never, Snapshot>;
export type XStateConfig<Machine extends AnyStateMachine, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Host = unknown> = {
    adapter?: "xstate";
    source: Machine | XStateActorInstance<Machine>;
    states?: FacadeStatesCallback<ExtendedState<Machine>, StatesResult>;
    commands?: FacadeCommandsCallback<XStateCommandActor<Machine>, CommandsResult, Host>;
    events?: EventsDefinition<Events>;
    cleanup?: boolean;
};
//# sourceMappingURL=types.d.ts.map
