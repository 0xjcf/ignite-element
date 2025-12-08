import createMobXAdapter, { type MobxEvent } from "../adapters/MobxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
} from "../RenderArgs";
import type { IgniteCoreReturn, MobxConfig } from "./types";

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
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
		StatesResult,
		State,
		CommandsResult,
		Events
	>;
}
