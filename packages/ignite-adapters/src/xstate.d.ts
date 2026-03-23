import { matchState } from "ignite-core";
import type { EmptyEventMap, EventBuilder, EventMap, FacadeEffectsCallback, FacadeEffectsObjectCallback, FacadeCommandFunction, FacadeCommandResult, FacadeCommandsCallback, FacadeStatesCallback, FacadeViewCallback, IgniteCoreReturn } from "ignite-core";
import type { AnyStateMachine, EventFrom } from "xstate";
import createXStateAdapter, { type ExtendedState, type XStateActorInstance, type XStateCommandActor, type XStateSnapshot } from "./adapters/XStateAdapter";
import { isXStateActor, isXStateMachine } from "./utils/adapterGuards";
export type { ExtendedState, XStateActorInstance, XStateCommandActor, XStateSnapshot };
export type EventsDefinition<Events> = (event: EventBuilder) => Events;
type XStateConfigBase<Machine extends AnyStateMachine, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Host = unknown> = {
    adapter?: "xstate";
    source: Machine | XStateActorInstance<Machine>;
    states?: FacadeStatesCallback<ExtendedState<Machine>, StatesResult>;
    view?: FacadeViewCallback<ExtendedState<Machine>, StatesResult>;
    commands?: FacadeCommandsCallback<XStateCommandActor<Machine>, CommandsResult, Host>;
    events?: EventsDefinition<Events>;
    cleanup?: boolean;
};
type XStateEffectsOptions<Machine extends AnyStateMachine, Events extends EventMap, Host> = {
    effects?: FacadeEffectsCallback<ExtendedState<Machine>, XStateCommandActor<Machine>, Events, Host>;
} | {
    effects?: FacadeEffectsObjectCallback<ExtendedState<Machine>, XStateCommandActor<Machine>, Events, Host>;
};
export type XStateConfig<Machine extends AnyStateMachine, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Host = unknown> = XStateConfigBase<Machine, Events, StatesResult, CommandsResult, Host> & XStateEffectsOptions<Machine, Events, Host>;
export declare function igniteCore<Machine extends AnyStateMachine, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends Record<never, FacadeCommandFunction> = Record<never, FacadeCommandFunction>, Host = unknown>(options: XStateConfig<Machine, Events, StatesResult, CommandsResult, Host>): IgniteCoreReturn<ExtendedState<Machine>, EventFrom<Machine>, ExtendedState<Machine>, StatesResult, XStateCommandActor<Machine>, CommandsResult, Events, Host>;
export { createXStateAdapter, isXStateActor, isXStateMachine, matchState, };
//# sourceMappingURL=xstate.d.ts.map