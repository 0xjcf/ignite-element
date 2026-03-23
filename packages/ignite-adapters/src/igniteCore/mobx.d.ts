import type { EmptyEventMap, EventMap, FacadeCommandFunction, IgniteCoreReturn } from "ignite-core";
import { type MobxEvent } from "../adapters/MobxAdapter";
import type { MobxConfig } from "../types";
export declare function igniteCoreMobx<State extends object, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends Record<never, FacadeCommandFunction> = Record<never, FacadeCommandFunction>, Host = unknown>(options: MobxConfig<State, Events, StatesResult, CommandsResult, Host>): IgniteCoreReturn<State, MobxEvent<State>, State, StatesResult, State, CommandsResult, Events, Host>;
//# sourceMappingURL=mobx.d.ts.map