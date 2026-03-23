import type IgniteAdapter from "../IgniteAdapter";
import type { EmitFromEvents, EmptyEventMap, EventMap, FacadeEffectsLike } from "../RenderArgs";
export declare const facadeCleanupSymbol: unique symbol;
export type FacadeLifecycle = {
    [facadeCleanupSymbol]?: () => void;
};
type AttachEffectsOptions<State, Event, Snapshot, CommandActor, Events extends EventMap = EmptyEventMap, Host = unknown> = {
    adapter: IgniteAdapter<State, Event>;
    effects: FacadeEffectsLike<Snapshot, CommandActor, Events, Host>;
    resolveSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
    resolveActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
    host: Host;
    emit: EmitFromEvents<Events>;
};
export declare function attachEffects<State, Event, Snapshot, CommandActor, Events extends EventMap = EmptyEventMap, Host = unknown>({ adapter, effects, resolveSnapshot, resolveActor, host, emit, }: AttachEffectsOptions<State, Event, Snapshot, CommandActor, Events, Host>): () => void;
export {};
//# sourceMappingURL=effects.d.ts.map