import type {
	EmptyEventMap,
	EventBuilder,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectArgs,
	FacadeStatesCallback,
	FacadeViewCallback,
} from "ignite-core";
import type { AnyStateMachine } from "xstate";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
	type XStateCommandActor,
	type XStateSnapshot,
} from "./adapters/XStateAdapter";
import { isXStateActor, isXStateMachine } from "./utils/adapterGuards";

export type {
	ExtendedState,
	XStateActorInstance,
	XStateCommandActor,
	XStateSnapshot,
};

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
	states?: FacadeStatesCallback<ExtendedState<Machine>, StatesResult>;
	view?: FacadeViewCallback<ExtendedState<Machine>, StatesResult>;
	commands?: FacadeCommandsCallback<
		XStateCommandActor<Machine>,
		CommandsResult,
		Host
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type XStateEffectsOptions<
	Machine extends AnyStateMachine,
	Events extends EventMap,
	Host,
> = {
	effects?: (
		args: FacadeEffectArgs<
			ExtendedState<Machine>,
			XStateCommandActor<Machine>,
			Events,
			Host
		>,
	) => void;
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
