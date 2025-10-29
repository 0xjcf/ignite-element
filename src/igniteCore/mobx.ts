import createMobXAdapter, { type MobxEvent } from "../adapters/MobxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "../RenderArgs";
import type { IgniteCoreReturn, MobxConfig } from "./types";

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult, Events>
		| undefined = undefined,
>(
	options: MobxConfig<State, Events, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StateCallback,
	State,
	CommandCallback,
	Events
> {
	const adapterFactory = createMobXAdapter(options.source);
	const eventDefinitions = options.events?.(event);
	return createComponentFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		events: eventDefinitions,
		cleanup: options.cleanup,
	}) as IgniteCoreReturn<
		State,
		MobxEvent<State>,
		State,
		StateCallback,
		State,
		CommandCallback,
		Events
	>;
}
