import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";
import type { AnyStateMachine, StateFrom } from "xstate";
import createXStateAdapter, {
	type XStateActorInstance,
	type XStateCommandActor,
	type XStateSnapshot,
} from "./adapters/XStateAdapter";
import { isXStateActor, isXStateMachine } from "./utils/adapterGuards";

export type { XStateActorInstance, XStateCommandActor, XStateSnapshot };

export type EventsDefinition<Events> = (event: EventBuilder) => Events;

type XStateConfigBase<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: FacadeStatesCallback<StateFrom<Machine>, StatesResult>;
	commands?: FacadeCommandsCallback<
		XStateCommandActor<Machine>,
		CommandsResult,
		Host,
		StateFrom<Machine>
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type XStateEffectsOptions<
	Machine extends AnyStateMachine,
	Events extends EventMap,
	Host,
> = {
	effects?: FacadeEffectsObjectCallback<
		StateFrom<Machine>,
		XStateCommandActor<Machine>,
		Events,
		Host
	>;
};

export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = XStateConfigBase<Machine, Events, StatesResult, CommandsResult, Host> &
	XStateEffectsOptions<Machine, Events, Host>;

export { createXStateAdapter, isXStateActor, isXStateMachine };
