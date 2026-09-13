import type { XStateConfig as AdapterXStateConfig } from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { AnyStateMachine } from "xstate";
import type { DisjointBindings } from "./publicTypes";

export type { IgniteCoreReturn, WithEmittedEvents } from "./publicTypes";
export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = AdapterXStateConfig<
	Machine,
	Events,
	StatesResult,
	CommandsResult,
	unknown
> &
	DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;
