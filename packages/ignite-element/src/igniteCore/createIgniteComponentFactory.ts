import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
	IgniteAdapter,
} from "@ignite-element/core";
import { event, StateScope } from "@ignite-element/core";
import { createComponentFactory } from "../createComponentFactory";
import { createProjectionFactory } from "../createProjectionFactory";
import { assertSupportedSourceOptions } from "../internal/assertSupportedSourceOptions";
import {
	registerIndependentBinding,
	requireBindingStore,
} from "../runtime/bindings";
import { createIndependentBinding } from "../runtime/independentBinding";
import type { IgniteCoreReturn } from "./publicTypes";

export type IgniteComponentAdapterFactory<
	State,
	Event,
	Snapshot,
	CommandActor,
> = (() => IgniteAdapter<State, Event>) & {
	scope?: StateScope;
	resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
};

export type IgniteComponentFactoryOptions<
	Snapshot,
	CommandActor,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
> = {
	states?: FacadeStatesCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<
		CommandActor,
		CommandsResult,
		HTMLElement,
		Snapshot
	>;
	effects?: FacadeEffectsObjectCallback<
		Snapshot,
		CommandActor,
		Events,
		HTMLElement
	>;
	events?: ((builder: typeof event) => Events) | undefined;
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
	bindingAdapter?: IgniteComponentAdapterFactory<
		State,
		Event,
		Snapshot,
		CommandActor
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
	assertSupportedSourceOptions(options);
	if (
		Object.getOwnPropertyDescriptor(
			options as unknown as Record<string, unknown>,
			"view",
		) !== undefined
	) {
		throw new Error(
			"[igniteCore] Config `view` was removed; use `states` with a bare native snapshot callback.",
		);
	}
	const eventDefinitions = options.events?.(event);
	const core = createComponentFactory<
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
		states: options.states,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
	}) as unknown as IgniteCoreReturn<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Events
	>;
	// Only the source-core assembly promises ready framework bindings. Keep
	// low-level factories and isolated machine acquisition lazy.
	if (createAdapter.scope === StateScope.Shared) {
		try {
			requireBindingStore(core).prepare();
		} catch (error) {
			try {
				core.dispose();
			} catch (cleanupError) {
				console.error(
					"[igniteCore] Construction rollback failed.",
					cleanupError,
				);
			}
			throw error;
		}
	}
	if (bindingAdapter && createAdapter.scope === StateScope.Isolated) {
		registerIndependentBinding(core, (owner) =>
			createIndependentBinding<State, Event>(owner, (isSubscribed) => {
				const projection = createProjectionFactory(bindingAdapter, {
					...options,
					events: eventDefinitions,
					effects: options.effects
						? (context) => {
								if (isSubscribed()) return options.effects?.(context);
							}
						: undefined,
				});
				return {
					createAdapter: bindingAdapter,
					createArgs: (adapter, host) =>
						projection.createAdditionalArgs(
							adapter,
							host as HTMLElement,
							(emitted) => {
								const { type, ...detail } = emitted;
								host.dispatchEvent(new CustomEvent(type, { detail }));
							},
						),
					states: projection.resolveStates,
					delivered: projection.resolveDeliveredStates,
					dispose: projection.disposeEffects,
				};
			}),
		);
	}
	return core;
}
