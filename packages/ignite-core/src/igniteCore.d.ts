import type { AnyStateMachine, EventFrom } from "xstate";
import { type ExtendedState, type XStateCommandActor } from "./adapters/XStateAdapter";
import type { EmptyEventMap, EventMap, FacadeCommandFunction } from "./RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";
export declare function igniteCore<Machine extends AnyStateMachine, Events extends EventMap = EmptyEventMap, StatesResult extends Record<string, unknown> = Record<never, never>, CommandsResult extends Record<never, FacadeCommandFunction> = Record<never, FacadeCommandFunction>, Host = unknown>(options: XStateConfig<Machine, Events, StatesResult, CommandsResult, Host>): IgniteCoreReturn<ExtendedState<Machine>, EventFrom<Machine>, ExtendedState<Machine>, StatesResult, XStateCommandActor<Machine>, CommandsResult, Events, Host>;
//# sourceMappingURL=igniteCore.d.ts.map