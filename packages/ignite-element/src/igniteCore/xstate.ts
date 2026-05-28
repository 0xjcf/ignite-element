import type { ExtendedState, XStateCommandActor } from "ignite-adapters/xstate";
import { createXStateAdapter } from "ignite-adapters/xstate";
import type { AnyStateMachine, EventFrom } from "xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type { IgniteCoreReturn, XStateConfig } from "./types";

export function igniteCoreXState<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
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
	const createAdapter = createXStateAdapter(options.source);
	return createIgniteComponentFactory<
		ExtendedState<Machine>,
		EventFrom<Machine>,
		ExtendedState<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		Events
	>(createAdapter, options);
}
