import { StateScope, type IgniteAdapter } from "@ignite-element/core";
import type { BaseRenderArgs, PublicFacadeRenderArgs } from "./types/render";

export type { PublicFacadeRenderArgs } from "./types/render";

import type {
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	EventMember,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "./RenderArgs";
import {
	assertNoCollisions,
	createCommandOwner,
	guardCommand,
} from "./runtime/bindings";
import {
	attachEffects,
	type FacadeLifecycle,
	facadeCleanupSymbol,
	registerHostEffects,
} from "./runtime/effects";
import { createLifetime, releaseAll } from "./runtime/lifetime";

export type StandardCommandActor<State, Event> = {
	send: (event: Event) => void;
	getState: () => State;
};

export type AdapterCreator<State, Event, Host = EventTarget> = ((
	host?: Host,
) => IgniteAdapter<State, Event>) & {
	scope?: StateScope;
};

export type AdapterFactory<
	State,
	Event,
	Host = EventTarget,
	Snapshot = State,
	CommandActor = StandardCommandActor<State, Event>,
> = AdapterCreator<State, Event, Host> & {
	resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
};

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

export type ProjectionFactoryOptions<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
	Host = EventTarget,
> = {
	scope?: StateScope;
	states?: FacadeStatesCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<
		CommandActor,
		CommandsResult,
		Host,
		Snapshot
	>;
	effects?: FacadeEffectsObjectCallback<Snapshot, CommandActor, Events, Host>;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: Host,
	) => Additional;
	events?: Events;
	cleanup?: boolean;
	debugName?: string;
};

export type WithFacadeRenderArgs<
	State,
	Event,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
> = BaseRenderArgs<State, Event> &
	PublicFacadeRenderArgs<
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events
	>;

export type ProjectionFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	Host = EventTarget,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
> = {
	createAdapter: AdapterCreator<State, Event, Host>;
	scope?: StateScope;
	cleanup?: boolean;
	eventTypes: readonly (keyof Events & string)[];
	hasCommands: boolean;
	disposeEffects: () => void;
	hasActiveEffects: (adapter: IgniteAdapter<State, Event>) => boolean;
	resolveInspection: (adapter: IgniteAdapter<State, Event>) => {
		snapshot: unknown;
		states: FacadeStateResult<StatesResult>;
	};
	resolveStates: (
		adapter: IgniteAdapter<State, Event>,
	) => FacadeStateResult<StatesResult>;
	resolveDeliveredStates: (snapshot: State) => FacadeStateResult<StatesResult>;
	createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host: Host,
		emit: EmitFromEvents<Events>,
		observeEffect?: (name: string) => void,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	createRenderArgs: (
		snapshot: State,
		send: (event: Event) => void,
		additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>,
	) => RenderArgs;
};

type FacadeStateResult<Result> = [Result] extends [Record<string, unknown>]
	? Result
	: Record<never, never>;

type ExtractCommandResult<Result> = [Result] extends [FacadeCommandResult]
	? Result
	: Record<never, never>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDevelopment = () =>
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

function freezeIfDev<T extends object>(value: T): T {
	return isDevelopment() ? Object.freeze(value) : value;
}

function ensureFacadeResult(
	result: unknown,
	feature: "states" | "commands",
	errorPrefix: string,
) {
	if (!isPlainObject(result)) {
		throw new Error(
			`[${errorPrefix}] Facade ${feature} callback must return a plain object.`,
		);
	}
}

function assertCommandFunction(
	value: unknown,
	key: string,
	errorPrefix: string,
) {
	if (typeof value !== "function") {
		throw new Error(
			`[${errorPrefix}] Facade commands must return functions. Property "${key}" is not callable.`,
		);
	}
}

/**
 * @internal Low-level projection factory used by `igniteCore`. Not part of the
 * public `ignite-element` surface — no package entry re-exports it.
 */
export function createProjectionFactory<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
>(
	createAdapter: AdapterFactory<State, Event, Host, Snapshot, CommandActor>,
	options?: ProjectionFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events,
		Host
	>,
): ProjectionFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events
	>,
	Host,
	Events,
	StatesResult
> {
	if (
		options &&
		Object.getOwnPropertyDescriptor(
			options as Record<string, unknown>,
			"view",
		) !== undefined
	) {
		throw new Error(
			"[createProjectionFactory] Config `view` was removed; use `states` with a bare native snapshot callback.",
		);
	}
	const {
		scope,
		states,
		commands,
		effects,
		resolveStateSnapshot,
		resolveCommandActor,
		createAdditionalArgs,
		events,
		cleanup,
		debugName,
	} = options ?? {};
	const errorPrefix = debugName ?? "createProjectionFactory";

	const resolveSnapshot =
		resolveStateSnapshot ?? createAdapter.resolveStateSnapshot;
	const resolveActor = resolveCommandActor ?? createAdapter.resolveCommandActor;

	const userAdditionalArgs = createAdditionalArgs ?? (() => ({}) as Additional);
	const resolvedStates = states;
	const emptyStates = Object.freeze({}) as FacadeStateResult<StatesResult>;
	const deriveStates = (
		snapshot: Snapshot,
	): FacadeStateResult<StatesResult> => {
		if (!resolvedStates) {
			return emptyStates;
		}

		const result = resolvedStates(snapshot);
		ensureFacadeResult(result, "states", errorPrefix);
		return result;
	};
	const resolveInspection: ProjectionFactory<
		State,
		Event,
		FinalRenderArgs,
		Host,
		Events,
		StatesResult
	>["resolveInspection"] = (adapter: IgniteAdapter<State, Event>) => {
		const snapshot = resolveSnapshot(adapter);
		return {
			snapshot,
			states: deriveStates(snapshot),
		};
	};
	const resolveStates = (
		adapter: IgniteAdapter<State, Event>,
	): FacadeStateResult<StatesResult> => {
		return resolveInspection(adapter).states;
	};
	const resolveDeliveredStates = (
		snapshot: State,
	): FacadeStateResult<StatesResult> =>
		deriveStates(snapshot as unknown as Snapshot);

	type FinalRenderArgs = WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events
	>;

	const eventDefinitions = events ?? (Object.create(null) as Events);

	const createEmit = (emit: EmitFromEvents<Events>): EmitFromEvents<Events> => {
		return <Type extends keyof Events & string>(
			event: EventMember<Events, Type>,
		) => {
			if (isDevelopment()) {
				if (!(event.type in eventDefinitions)) {
					throw new Error(
						`[${errorPrefix}] Unknown event "${event.type}". Declare it in the events map before emitting.`,
					);
				}
			}

			return emit(event);
		};
	};

	const createMergedArgs = (
		adapter: IgniteAdapter<State, Event>,
		host: Host,
		emit: EmitFromEvents<Events>,
		observeEffect?: (name: string) => void,
	): AdditionalRenderArgs<State, Event, FinalRenderArgs> => {
		if (!host) {
			throw new Error(
				`[${errorPrefix}] Unable to resolve host for command context.`,
			);
		}

		const extras = userAdditionalArgs(adapter, host);
		const merged = Object.create(null) as AdditionalRenderArgs<
			State,
			Event,
			FinalRenderArgs
		> &
			FacadeLifecycle;

		Object.defineProperties(merged, {
			...Object.getOwnPropertyDescriptors(extras),
		});

		const localLifetime = createLifetime();
		const owner = createCommandOwner(merged);
		if (commands) {
			const commandCallback = commands as FacadeCommandsCallback<
				CommandActor,
				CommandsResult,
				Host,
				Snapshot
			>;
			const actor = resolveActor(adapter);
			const commandResult = commandCallback({
				actor,
			});
			ensureFacadeResult(commandResult, "commands", errorPrefix);

			const entries = Object.entries(commandResult) as Array<
				[keyof ExtractCommandResult<CommandsResult>, unknown]
			>;
			const commandFacade = Object.create(
				null,
			) as ExtractCommandResult<CommandsResult>;

			for (const [key, value] of entries) {
				assertCommandFunction(value, String(key), errorPrefix);
				Object.defineProperty(commandFacade, key, {
					configurable: false,
					enumerable: true,
					value: guardCommand(value as FacadeCommandFunction, () => {
						localLifetime.assertActive();
						owner.assertActive();
					}),
				});
			}

			Object.defineProperties(merged, {
				...Object.getOwnPropertyDescriptors(freezeIfDev(commandFacade)),
			});
		}

		assertNoCollisions(resolveStates(adapter), merged);
		const releaseEffects = registerEffects(adapter, host, emit, observeEffect);
		Object.defineProperty(merged, facadeCleanupSymbol, {
			value: () => localLifetime.dispose(releaseEffects),
		});

		return merged;
	};
	type Recipient = { active: boolean; emit: EmitFromEvents<Events> };
	const owners = new Map<
		IgniteAdapter<State, Event>,
		{
			active: boolean;
			lifetime: ReturnType<typeof createLifetime>;
			recipients: Set<Recipient>;
		}
	>();
	// This map belongs to one core, not the process or the borrowed source.
	// Recipient leases and evaluator lifetimes are intentionally independent.
	let ended = false;
	const registerEffects = (
		adapter: IgniteAdapter<State, Event>,
		host: Host,
		emit: EmitFromEvents<Events>,
		observe?: (name: string) => void,
	): (() => void) | undefined => {
		if (!effects) return;
		if (ended) throw new Error("[igniteCore] Effect owner is disposed.");
		let owner = owners.get(adapter);
		if (!owner) {
			owner = {
				active: false,
				lifetime: createLifetime(),
				recipients: new Set(),
			};
			owners.set(adapter, owner);
		}
		const current = owner;
		const recipient: Recipient = { active: false, emit };
		current.recipients.add(recipient);
		const unregister = registerHostEffects(host as object, () => {
			current.lifetime.assertActive();
			recipient.active = true;
			if (current.active) return;
			current.active = true;
			try {
				const release = attachEffects({
					adapter,
					effects,
					resolveSnapshot,
					// No element is the error owner of a shared source evaluator.
					host: {},
					isActive: () => current.lifetime.active,
					emit: createEmit((event) => {
						if (!current.lifetime.active) return;
						observe?.(event.type);
						const delivered = { ...event };
						for (const target of [...current.recipients]) {
							if (!current.lifetime.active) break;
							if (target.active && current.recipients.has(target))
								target.emit(delivered);
						}
					}),
				});
				current.lifetime.own(release);
			} catch (error) {
				current.active = false;
				recipient.active = false;
				throw error;
			}
		});
		return () => {
			recipient.active = false;
			unregister();
			current.recipients.delete(recipient);
			if (
				(adapter.scope ?? scope ?? createAdapter.scope) !== StateScope.Shared &&
				!current.recipients.size
			) {
				owners.delete(adapter);
				current.lifetime.dispose();
			}
		};
	};

	return {
		createAdapter,
		scope: scope ?? createAdapter.scope,
		cleanup,
		eventTypes: Object.keys(eventDefinitions) as Array<keyof Events & string>,
		hasCommands: commands !== undefined,
		disposeEffects: () => {
			ended = true;
			const owned = [...owners.values()];
			owners.clear();
			releaseAll(owned.map((owner) => () => owner.lifetime.dispose()));
		},
		hasActiveEffects: (adapter) => owners.get(adapter)?.active === true,
		resolveInspection,
		resolveStates,
		resolveDeliveredStates,
		createAdditionalArgs: createMergedArgs,
		createRenderArgs: (snapshot, _send, additionalArgs) => {
			const states = resolveDeliveredStates(snapshot);
			assertNoCollisions(states, additionalArgs);
			return { ...states, ...additionalArgs } as unknown as FinalRenderArgs;
		},
	};
}
