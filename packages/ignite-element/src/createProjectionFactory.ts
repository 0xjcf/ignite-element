import type { IgniteAdapter, StateScope } from "@ignite-element/core";
import type { BaseRenderArgs } from "./IgniteElementFactory";
import type {
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsLike,
	FacadeViewCallback,
	ViewContext,
} from "./RenderArgs";
import { command as commandHelper } from "./runtime/commands";
import {
	attachEffects,
	type FacadeLifecycle,
	facadeCleanupSymbol,
} from "./runtime/effects";

export type AdapterFactory<State, Event, Host = unknown> = ((
	host?: Host,
) => IgniteAdapter<State, Event>) & {
	scope?: StateScope;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => unknown;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => unknown;
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
	CommandActor = unknown,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = {
	scope?: StateScope;
	view?: FacadeViewCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<CommandActor, CommandsResult, Host>;
	effects?: FacadeEffectsLike<Snapshot, CommandActor, Events, Host>;
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
	Additional &
	FacadeStateResult<StatesResult> &
	ExtractCommandResult<CommandsResult> &
	Phantom<CommandActor> &
	Phantom<Events>;

export type ProjectionFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	Host = unknown,
	Events extends EventMap = EmptyEventMap,
	ViewResult extends Record<string, unknown> = Record<never, never>,
> = {
	createAdapter: AdapterFactory<State, Event, Host>;
	scope?: StateScope;
	cleanup?: boolean;
	eventTypes: readonly (keyof Events & string)[];
	resolveView: (
		adapter: IgniteAdapter<State, Event>,
	) => FacadeStateResult<ViewResult>;
	createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host: Host,
		emit: EmitFromEvents<Events>,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
};

type FacadeStateResult<Result> = [Result] extends [Record<string, unknown>]
	? Result
	: Record<never, never>;

type ExtractCommandResult<Result> = [Result] extends [FacadeCommandResult]
	? Result
	: Record<never, never>;

type Phantom<T> = Record<never, T>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDevelopment = () => process.env.NODE_ENV !== "production";

function freezeIfDev<T extends object>(value: T): T {
	return isDevelopment() ? Object.freeze(value) : value;
}

const createViewContext = <Snapshot>(
	snapshot: Snapshot,
): ViewContext<Snapshot> => {
	if (typeof snapshot === "object" && snapshot !== null) {
		return {
			...(snapshot as object),
			snapshot,
		} as ViewContext<Snapshot>;
	}

	return { snapshot } as ViewContext<Snapshot>;
};

function ensureFacadeResult(
	result: unknown,
	feature: "view" | "commands",
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
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
	FactoryResult = ProjectionFactory<
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
	>,
>(
	createAdapter: AdapterFactory<State, Event, Host>,
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
): FactoryResult {
	const {
		scope,
		view,
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
		resolveStateSnapshot ??
		(createAdapter.resolveStateSnapshot as
			| ((adapter: IgniteAdapter<State, Event>) => Snapshot)
			| undefined) ??
		((adapter: IgniteAdapter<State, Event>) =>
			adapter.getSnapshot() as unknown as Snapshot);

	const resolveActor =
		resolveCommandActor ??
		(createAdapter.resolveCommandActor as
			| ((adapter: IgniteAdapter<State, Event>) => CommandActor)
			| undefined) ??
		((adapter: IgniteAdapter<State, Event>) =>
			({
				send: (event: Event) => adapter.send(event),
				getState: () => adapter.getSnapshot(),
			}) as CommandActor);

	const userAdditionalArgs = createAdditionalArgs ?? (() => ({}) as Additional);
	const resolvedView = view;
	const resolveView = (
		adapter: IgniteAdapter<State, Event>,
	): FacadeStateResult<StatesResult> => {
		if (resolvedView) {
			const result = resolvedView(createViewContext(resolveSnapshot(adapter)));
			ensureFacadeResult(result, "view", errorPrefix);
			return result;
		}

		return Object.create(null) as FacadeStateResult<StatesResult>;
	};

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
			type: Type,
			...args: EmitPayloadArgs<Events, Type>
		) => {
			if (isDevelopment()) {
				if (!(type in eventDefinitions)) {
					throw new Error(
						`[${errorPrefix}] Unknown event "${type}". Declare it in the events map before emitting.`,
					);
				}
			}

			return emit(type, ...args);
		};
	};

	const createMergedArgs = (
		adapter: IgniteAdapter<State, Event>,
		host: Host,
		emit: EmitFromEvents<Events>,
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

		if (resolvedView) {
			const initial = resolveView(adapter);
			const stateFacade = Object.create(
				null,
			) as FacadeStateResult<StatesResult>;

			for (const key of Object.keys(initial)) {
				Object.defineProperty(stateFacade, key, {
					configurable: false,
					enumerable: true,
					get: () => (resolveView(adapter) as Record<string, unknown>)[key],
				});
			}

			Object.defineProperties(merged, {
				...Object.getOwnPropertyDescriptors(freezeIfDev(stateFacade)),
			});
		}

		if (commands) {
			const commandCallback = commands as FacadeCommandsCallback<
				CommandActor,
				CommandsResult,
				Host
			>;
			const actor = resolveActor(adapter);
			const commandResult = commandCallback({
				actor,
				command: commandHelper,
				host,
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
					value,
				});
			}

			Object.defineProperties(merged, {
				...Object.getOwnPropertyDescriptors(freezeIfDev(commandFacade)),
			});
		}

		if (effects) {
			const safeEmit = createEmit(emit);
			Object.defineProperty(merged, facadeCleanupSymbol, {
				configurable: true,
				enumerable: false,
				value: attachEffects({
					adapter,
					effects,
					resolveActor,
					resolveSnapshot,
					host,
					emit: safeEmit,
				}),
			});
		}

		return merged;
	};

	return {
		createAdapter,
		scope: scope ?? createAdapter.scope,
		cleanup,
		eventTypes: Object.keys(eventDefinitions) as Array<keyof Events & string>,
		resolveView,
		createAdditionalArgs: createMergedArgs as ProjectionFactory<
			State,
			Event,
			FinalRenderArgs,
			Host,
			Events,
			StatesResult
		>["createAdditionalArgs"],
	} as FactoryResult;
}
