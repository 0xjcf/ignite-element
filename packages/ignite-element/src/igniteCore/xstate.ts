import type { XStateCommandActor } from "@ignite-element/adapters/xstate";
import { createXStateAdapter } from "@ignite-element/adapters/xstate";
import type {
	AnyStateMachine,
	EmittedFrom,
	EventFrom,
	StateFrom,
} from "xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type {
	IgniteCoreReturn,
	WithEmittedEvents,
	XStateConfig,
} from "./types";

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
	StateFrom<Machine>,
	EventFrom<Machine>,
	StateFrom<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	WithEmittedEvents<Events, EmittedFrom<Machine>, EventFrom<Machine>>
> {
	const createAdapter = createXStateAdapter(options.source);
	// The machine's emitted union widens the static events map only; the
	// runtime's declared eventTypes stay driven by the `events:` config (the
	// adapter subscribeEvents() bridge surfaces emitted events dynamically).
	return createIgniteComponentFactory<
		StateFrom<Machine>,
		EventFrom<Machine>,
		StateFrom<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		Events
	>(createAdapter, options) as IgniteCoreReturn<
		StateFrom<Machine>,
		EventFrom<Machine>,
		StateFrom<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		WithEmittedEvents<Events, EmittedFrom<Machine>, EventFrom<Machine>>
	>;
}
