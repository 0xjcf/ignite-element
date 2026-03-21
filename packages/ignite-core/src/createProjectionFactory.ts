import type IgniteAdapter from "./IgniteAdapter";
import type { StateScope } from "./IgniteAdapter";
import type {
	BaseRenderArgs,
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "./RenderArgs";

export type AdapterFactory<State, Event> = (() => IgniteAdapter<
	State,
	Event
>) & {
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
	states?: FacadeStatesCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<CommandActor, CommandsResult, Events, Host>;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: Host,
	) => Additional;
	events?: Events;
	cleanup?: boolean;
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
> = {
	createAdapter: AdapterFactory<State, Event>;
	scope?: StateScope;
	cleanup?: boolean;
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

function ensureFacadeResult(result: unknown, feature: "states" | "commands") {
	if (!isPlainObject(result)) {
		throw new Error(
			`[createProjectionFactory] Facade ${feature} callback must return a plain object.`,
		);
	}
}

function assertCommandFunction(value: unknown, key: string) {
	if (typeof value !== "function") {
		throw new Error(
			`[createProjectionFactory] Facade commands must return functions. Property "${key}" is not callable.`,
		);
	}
}

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
		Events
	>,
>(
	createAdapter: AdapterFactory<State, Event>,
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
		states,
		commands,
		resolveStateSnapshot,
		resolveCommandActor,
		createAdditionalArgs,
		events,
		cleanup,
	} = options ?? {};

	const resolveSnapshot =
		resolveStateSnapshot ??
		(createAdapter.resolveStateSnapshot as
			| ((adapter: IgniteAdapter<State, Event>) => Snapshot)
			| undefined) ??
		((adapter: IgniteAdapter<State, Event>) =>
			adapter.getState() as unknown as Snapshot);

	const resolveActor =
		resolveCommandActor ??
		(createAdapter.resolveCommandActor as
			| ((adapter: IgniteAdapter<State, Event>) => CommandActor)
			| undefined) ??
		((adapter: IgniteAdapter<State, Event>) =>
			({
				send: (event: Event) => adapter.send(event),
				getState: () => adapter.getState(),
			}) as CommandActor);

	const userAdditionalArgs = createAdditionalArgs ?? (() => ({}) as Additional);

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
						`[createProjectionFactory] Unknown event "${type}". Declare it in the events map before emitting.`,
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
				"[createProjectionFactory] Unable to resolve host for command context.",
			);
		}

		const extras = userAdditionalArgs(adapter, host);
		const merged = Object.create(null) as AdditionalRenderArgs<
			State,
			Event,
			FinalRenderArgs
		>;

		Object.defineProperties(merged, {
			...Object.getOwnPropertyDescriptors(extras),
		});

		if (states) {
			const stateCallback = states as FacadeStatesCallback<
				Snapshot,
				StatesResult
			>;
			const getLatestStates = () => {
				const snapshot = resolveSnapshot(adapter);
				const result = stateCallback(snapshot);
				ensureFacadeResult(result, "states");
				return result;
			};

			const initial = getLatestStates();
			const stateFacade = Object.create(
				null,
			) as FacadeStateResult<StatesResult>;

			for (const key of Object.keys(initial)) {
				Object.defineProperty(stateFacade, key, {
					configurable: false,
					enumerable: true,
					get: () => getLatestStates()[key],
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
				Events,
				Host
			>;
			const actor = resolveActor(adapter);
			const safeEmit = createEmit(emit);
			const commandResult = commandCallback({
				actor,
				emit: safeEmit,
				host,
			});
			ensureFacadeResult(commandResult, "commands");

			const entries = Object.entries(commandResult) as Array<
				[keyof ExtractCommandResult<CommandsResult>, unknown]
			>;
			const commandFacade = Object.create(
				null,
			) as ExtractCommandResult<CommandsResult>;

			for (const [key, value] of entries) {
				assertCommandFunction(value, String(key));
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

		return merged;
	};

	return {
		createAdapter,
		scope: scope ?? createAdapter.scope,
		cleanup,
		createAdditionalArgs: createMergedArgs as ProjectionFactory<
			State,
			Event,
			FinalRenderArgs,
			Host,
			Events
		>["createAdditionalArgs"],
	} as FactoryResult;
}
