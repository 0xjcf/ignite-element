import type { ExtendedState, XStateCommandActor } from "ignite-adapters/xstate";
import { igniteCore as igniteCoreProjection } from "ignite-adapters/xstate";
import type { AnyStateMachine, EventFrom } from "xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import { bindProjectionToElements } from "../createComponentFactory";
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
	const projection = igniteCoreProjection(options);
	return bindProjectionToElements(projection, {
		errorPrefix: "igniteCore",
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
