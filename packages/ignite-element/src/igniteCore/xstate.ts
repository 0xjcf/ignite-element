import type { XStateCommandActor } from "@ignite-element/adapters/xstate";
import { createXStateAdapter } from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import { type IgniteAdapter, StateScope } from "@ignite-element/core";
import type {
	AnyStateMachine,
	EmittedFrom,
	EventFrom,
	StateFrom,
} from "xstate";
import { createActor } from "xstate";
import { assertSupportedSourceOptions } from "../internal/assertSupportedSourceOptions";
import { releaseAll } from "../runtime/lifetime";
import type {
	IgniteComponentAdapterFactory,
	IgniteComponentFactoryOptions,
} from "./createIgniteComponentFactory";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
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
	WithEmittedEvents<Events, EmittedFrom<Machine>, never>,
	Events
> {
	assertSupportedSourceOptions(options);
	const createAdapter = createXStateAdapter(options.source);
	// Actor construction computes context/assignments for the initial snapshot.
	// Deferred actions, invoked actors and timers wait for committed subscription.
	// All snapshot initialization must be safe to repeat and discard.
	const bindingAdapter: IgniteComponentAdapterFactory<
		StateFrom<Machine>,
		EventFrom<Machine>,
		StateFrom<Machine>,
		XStateCommandActor<Machine>
	> = Object.assign(
		() => {
			const actor = createActor(options.source as Machine);
			let active:
				| IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>
				| undefined;
			const activate = () => {
				if (!active) active = createXStateAdapter(actor)();
				return active;
			};
			return {
				scope: StateScope.Isolated,
				getSnapshot: () => actor.getSnapshot(),
				send: (event: EventFrom<Machine>) => actor.send(event),
				subscribeSnapshots: (
					listener: (snapshot: StateFrom<Machine>) => void,
				) => activate().subscribeSnapshots(listener),
				stop: () => releaseAll([() => active?.stop(), () => actor.stop()]),
			};
		},
		{
			resolveStateSnapshot: (
				adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
			) => adapter.getSnapshot(),
			resolveCommandActor: (
				adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
			) => ({ send: adapter.send, getSnapshot: adapter.getSnapshot }),
		},
	);
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
		bindingAdapter,
	) as IgniteCoreReturn<
		StateFrom<Machine>,
		EventFrom<Machine>,
		StateFrom<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		WithEmittedEvents<Events, EmittedFrom<Machine>, never>,
		Events
	>;
}
