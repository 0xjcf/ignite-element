import type { AnyStateMachine, EventFrom } from "xstate";
import createXStateAdapter, {
	type ExtendedState,
	type XStateCommandActor,
} from "../adapters/XStateAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
} from "../RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";

export function igniteCoreXState<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: XStateConfig<Machine, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	Events
> {
	const adapterFactory = createXStateAdapter(options.source);
	const eventDefinitions = options.events?.(event);
	return createComponentFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		events: eventDefinitions,
		cleanup: options.cleanup,
	}) as IgniteCoreReturn<
		ExtendedState<Machine>,
		EventFrom<Machine>,
		ExtendedState<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		Events
	>;
}
