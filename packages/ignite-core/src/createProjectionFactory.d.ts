import type IgniteAdapter from "./IgniteAdapter";
import type { StateScope } from "./IgniteAdapter";
import type { BaseRenderArgs, EmitFromEvents, EmptyEventMap, EventMap, FacadeCommandFunction, FacadeCommandResult, FacadeCommandsCallback, FacadeEffectsLike, FacadeStatesCallback, FacadeViewCallback } from "./RenderArgs";
export type AdapterFactory<State, Event> = (() => IgniteAdapter<State, Event>) & {
    scope?: StateScope;
    resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => unknown;
    resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => unknown;
};
type AdditionalRenderArgs<State, Event, RenderArgs extends BaseRenderArgs<State, Event>> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;
export type ProjectionFactoryOptions<State, Event, Snapshot, StatesResult extends Record<string, unknown> = Record<never, never>, CommandActor = unknown, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Additional extends Record<string, unknown> = Record<never, never>, Events extends EventMap = EmptyEventMap, Host = unknown> = {
    scope?: StateScope;
    states?: FacadeStatesCallback<Snapshot, StatesResult>;
    view?: FacadeViewCallback<Snapshot, StatesResult>;
    commands?: FacadeCommandsCallback<CommandActor, CommandsResult, Host>;
    effects?: FacadeEffectsLike<Snapshot, CommandActor, Events, Host>;
    resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
    resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
    createAdditionalArgs?: (adapter: IgniteAdapter<State, Event>, host?: Host) => Additional;
    events?: Events;
    cleanup?: boolean;
};
export type WithFacadeRenderArgs<State, Event, StatesResult, CommandActor, CommandsResult, Additional extends Record<string, unknown> = Record<never, never>, Events extends EventMap = EmptyEventMap> = BaseRenderArgs<State, Event> & Additional & FacadeStateResult<StatesResult> & ExtractCommandResult<CommandsResult> & Phantom<CommandActor> & Phantom<Events>;
export type ProjectionFactory<State, Event, RenderArgs extends BaseRenderArgs<State, Event>, Host = unknown, Events extends EventMap = EmptyEventMap, ViewResult extends Record<string, unknown> = Record<never, never>> = {
    createAdapter: AdapterFactory<State, Event>;
    scope?: StateScope;
    cleanup?: boolean;
    eventTypes: readonly (keyof Events & string)[];
    resolveView: (adapter: IgniteAdapter<State, Event>) => FacadeStateResult<ViewResult>;
    createAdditionalArgs: (adapter: IgniteAdapter<State, Event>, host: Host, emit: EmitFromEvents<Events>) => AdditionalRenderArgs<State, Event, RenderArgs>;
};
type FacadeStateResult<Result> = [Result] extends [Record<string, unknown>] ? Result : Record<never, never>;
type ExtractCommandResult<Result> = [Result] extends [FacadeCommandResult] ? Result : Record<never, never>;
type Phantom<T> = Record<never, T>;
export declare function createProjectionFactory<State, Event, Snapshot, StatesResult extends Record<string, unknown> = Record<never, never>, CommandActor = {
    send: (event: Event) => void;
    getState: () => State;
}, CommandsResult extends FacadeCommandResult = Record<never, FacadeCommandFunction>, Additional extends Record<string, unknown> = Record<never, never>, Events extends EventMap = EmptyEventMap, Host = unknown, FactoryResult = ProjectionFactory<State, Event, WithFacadeRenderArgs<State, Event, StatesResult, CommandActor, CommandsResult, Additional, Events>, Host, Events, StatesResult>>(createAdapter: AdapterFactory<State, Event>, options?: ProjectionFactoryOptions<State, Event, Snapshot, StatesResult, CommandActor, CommandsResult, Additional, Events, Host>): FactoryResult;
export {};
//# sourceMappingURL=createProjectionFactory.d.ts.map