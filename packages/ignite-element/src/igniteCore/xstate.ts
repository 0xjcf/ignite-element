import type { XStateCommandActor } from "@ignite-element/adapters/xstate";
import { createXStateAdapter } from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type {
	AnyStateMachine,
	EmittedFrom,
	EventFrom,
	StateFrom,
} from "xstate";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type { IgniteComponentFactoryOptions } from "./createIgniteComponentFactory";
import type {
	IgniteCoreReturn,
	WithEmittedEvents,
	XStateConfig,
} from "./xstateTypes";

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
	WithEmittedEvents<Events, EmittedFrom<Machine>, never>
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
		// Public configuration narrows the emitter to effect-owned names. It can
		// safely receive the assembly emitter, which supports all declared names.
	>(
		createAdapter,
		options as IgniteComponentFactoryOptions<
			StateFrom<Machine>,
			XStateCommandActor<Machine>,
			StatesResult,
			CommandsResult,
			Events
		>,
	) as IgniteCoreReturn<
		StateFrom<Machine>,
		EventFrom<Machine>,
		StateFrom<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		WithEmittedEvents<Events, EmittedFrom<Machine>, never>
	>;
}
