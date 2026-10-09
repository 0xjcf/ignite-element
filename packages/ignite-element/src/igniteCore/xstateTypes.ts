import type { XStateConfig as AdapterXStateConfig } from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeEffectsObjectCallback,
} from "@ignite-element/core";
import type { AnyStateMachine, EmittedFrom, StateFrom } from "xstate";
import type { IgniteHostMap } from "../hosts/types";
import type { CompatibleEvents, EffectEvents } from "./eventProducerTypes";
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
> = Omit<
	AdapterXStateConfig<Machine, Events, StatesResult, CommandsResult, unknown>,
	"effects" | "events"
> & {
	events?: (
		event: EventBuilder,
	) => Events & NoInfer<CompatibleEvents<Events, EmittedFrom<Machine>>>;
	effects?: FacadeEffectsObjectCallback<
		StateFrom<Machine>,
		unknown,
		EffectEvents<NoInfer<Events>, NoInfer<EmittedFrom<Machine>>>
	>;
} & DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>> & {
		hosts?: IgniteHostMap<StateFrom<Machine>>;
	};
