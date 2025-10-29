import type { AnyStateMachine, EventFrom } from "xstate";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
} from "../adapters/XStateAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "../RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";

export function igniteCoreXState<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				XStateActorInstance<Machine>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
>(
	options: XStateConfig<Machine, Events, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StateCallback,
	XStateActorInstance<Machine>,
	CommandCallback,
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
		StateCallback,
		XStateActorInstance<Machine>,
		CommandCallback,
		Events
	>;
}
