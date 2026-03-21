import type { AnyStateMachine, EventFrom } from "xstate";
import createXStateAdapter, {
	type ExtendedState,
	type XStateCommandActor,
} from "./adapters/XStateAdapter";
import { createProjectionFactory } from "./createProjectionFactory";
import { event } from "./events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
} from "./RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";

export function igniteCore<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: XStateConfig<Machine, Events, StatesResult, CommandsResult, Host>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	Events,
	Host
> {
	const adapterFactory = createXStateAdapter(options.source);
	const eventDefinitions = options.events?.(event);
	return createProjectionFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
		cleanup: options.cleanup,
	});
}
