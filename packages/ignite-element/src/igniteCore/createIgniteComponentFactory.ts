import type { IgniteAdapter, StateScope } from "@ignite-element/core";
import { event } from "@ignite-element/core";
import { createComponentFactory } from "../createComponentFactory";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsLike,
	FacadeViewCallback,
} from "../RenderArgs";
import type { IgniteCoreReturn } from "./types";

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

export type IgniteComponentFactoryOptions<
	Snapshot,
	CommandActor,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
> = {
	view?: FacadeViewCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<CommandActor, CommandsResult, HTMLElement>;
	effects?: FacadeEffectsLike<Snapshot, CommandActor, Events, HTMLElement>;
	events?: ((builder: typeof event) => Events) | undefined;
	/**
	 * Controls element-lifecycle teardown of the *shared* adapter.
	 *
	 * - **Isolated cores** (you pass a machine/store/factory that ignite
	 *   instantiates per element): defaults to `true` — each element's adapter is
	 *   stopped on disconnect. `cleanup` has no effect here.
	 * - **Shared cores** (you pass an already-live, consumer-owned source — a
	 *   started actor, store, observable, or actor-web source): defaults to
	 *   `false`. The source is yours and lives for the core's lifetime, so ignite
	 *   keeps the shared adapter alive across element disconnects (an outlet
	 *   swapping pages won't freeze it). Set `cleanup: true` to opt back into
	 *   element-refcount teardown of the adapter; ignite still never stops or
	 *   closes a source it did not create.
	 */
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
	options: IgniteComponentFactoryOptions<
		Snapshot,
		CommandActor,
		StatesResult,
		CommandsResult,
		Events
	>,
): IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Events
> {
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
		view: options.view,
		commands: options.commands,
		effects: options.effects,
		events: options.events?.(event),
		cleanup: options.cleanup,
	}) as IgniteCoreReturn<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Events
	>;
}
