import type { IgniteAdapter, StateScope } from "ignite-core";
import { event } from "ignite-core";
import { createComponentFactory } from "../createComponentFactory";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";

export type IgniteComponentAdapterFactory<
	State,
	Event,
	Snapshot,
	CommandActor,
> = (() => IgniteAdapter<State, Event>) & {
	scope?: StateScope;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
};

type IgniteComponentFactoryOptions<Events extends EventMap = EmptyEventMap> = {
	states?: unknown;
	view?: unknown;
	commands?: unknown;
	effects?: unknown;
	events?: ((builder: typeof event) => Events) | undefined;
	cleanup?: boolean;
};

export function createIgniteComponentFactory<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: IgniteComponentAdapterFactory<
		State,
		Event,
		Snapshot,
		CommandActor
	>,
	options: IgniteComponentFactoryOptions<Events>,
) {
	return createComponentFactory<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		Events
	>(createAdapter, {
		scope: createAdapter.scope,
		states: options.states as never,
		view: options.view as never,
		commands: options.commands as never,
		effects: options.effects as never,
		events: options.events?.(event),
		cleanup: options.cleanup,
	});
}
