import createMobXAdapter, { type MobxEvent } from "../adapters/MobxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import type {
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "../RenderArgs";
import type { IgniteCoreReturn, MobxConfig } from "./types";

export function igniteCoreMobx<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined,
>(
	options: MobxConfig<State, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StateCallback,
	State,
	CommandCallback
> {
	const adapterFactory = createMobXAdapter(options.source);
	return createComponentFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		cleanup: options.cleanup,
	});
}
