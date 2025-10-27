import type { AnyStateMachine, EventFrom } from "xstate";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
} from "../adapters/XStateAdapter";
import { createComponentFactory } from "../createComponentFactory";
import type {
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "../RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";

export function igniteCoreXState<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined,
>(
	options: XStateConfig<Machine, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StateCallback,
	XStateActorInstance<Machine>,
	CommandCallback
> {
	const adapterFactory = createXStateAdapter(options.source);
	return createComponentFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		cleanup: options.cleanup,
	});
}
