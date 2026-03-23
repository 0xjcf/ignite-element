import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	IgniteCoreReturn,
} from "ignite-core";
import { createProjectionFactory, event } from "ignite-core";
import createMobXAdapter, { type MobxEvent } from "../adapters/MobxAdapter";
import type { MobxConfig } from "../types";

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult, Host>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events,
	Host
> {
	const adapterFactory = createMobXAdapter(options.source);
	const eventDefinitions = options.events?.(event);
	return createProjectionFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		view: options.view,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
		cleanup: options.cleanup,
	});
}
