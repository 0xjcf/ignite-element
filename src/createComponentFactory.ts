import type IgniteAdapter from "./IgniteAdapter";
import type { StateScope } from "./IgniteAdapter";
import igniteElementFactory, {
	type BaseRenderArgs,
	type ComponentFactory,
} from "./IgniteElementFactory";
import type {
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "./RenderArgs";

type AdapterFactory<State, Event> = (() => IgniteAdapter<State, Event>) & {
	scope?: StateScope;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => unknown;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => unknown;
};

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

type FacadeStateResult<Snapshot, Callback> = [Callback] extends [
	FacadeStatesCallback<Snapshot, infer Result>,
]
	? Result
	: Record<never, never>;

type ExtractCommandResult<Actor, Callback> = [Callback] extends [
	FacadeCommandsCallback<Actor, infer Result>,
]
	? Result
	: Record<never, never>;

export type WithFacadeRenderArgs<
	State,
	Event,
	Snapshot,
	StateCallback,
	CommandActor,
	CommandCallback,
	Additional extends Record<string, unknown> = Record<never, never>,
> = BaseRenderArgs<State, Event> &
	Additional &
	FacadeStateResult<Snapshot, StateCallback> &
	ExtractCommandResult<CommandActor, CommandCallback>;

export type ComponentFactoryOptions<
	State,
	Event,
	Snapshot,
	StateCallback,
	CommandActor,
	CommandCallback,
	Additional extends Record<string, unknown> = Record<never, never>,
> = {
	scope?: StateScope;
	states?: StateCallback;
	commands?: CommandCallback;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	createAdditionalArgs?: (adapter: IgniteAdapter<State, Event>) => Additional;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDevelopment = () => process.env.NODE_ENV !== "production";

function freezeIfDev<T extends object>(value: T): T {
	return isDevelopment() ? Object.freeze(value) : value;
}

function ensureFacadeResult(result: unknown, feature: "states" | "commands") {
	if (!isPlainObject(result)) {
		throw new Error(
			`[createComponentFactory] Facade ${feature} callback must return a plain object.`,
		);
	}
}

function assertCommandFunction(value: unknown, key: string) {
	if (typeof value !== "function") {
		throw new Error(
			`[createComponentFactory] Facade commands must return functions. Property "${key}" is not callable.`,
		);
	}
}

export function createComponentFactory<
	State,
	Event,
	Snapshot,
	StateCallback extends
		| FacadeStatesCallback<Snapshot, Record<string, unknown>>
		| undefined = undefined,
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
	CommandCallback extends
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult>
		| undefined = undefined,
	Additional extends Record<string, unknown> = Record<never, never>,
>(
	createAdapter: AdapterFactory<State, Event>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
		Additional
	>,
): ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
		Additional
	>
> {
	const {
		scope,
		states,
		commands,
		resolveStateSnapshot,
		resolveCommandActor,
		createAdditionalArgs,
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
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
		Additional
	>;

	return igniteElementFactory<State, Event, FinalRenderArgs>(createAdapter, {
		scope: scope ?? createAdapter.scope,
		createAdditionalArgs: (adapter: IgniteAdapter<State, Event>) => {
			const extras = userAdditionalArgs(adapter);
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
					Record<string, unknown>
				>;
				const getLatestStates = () => {
					const snapshot = resolveSnapshot(adapter);
					const result = stateCallback(snapshot);
					ensureFacadeResult(result, "states");
					return result;
				};

				const initial = getLatestStates();
				const stateFacade = Object.create(null) as FacadeStateResult<
					Snapshot,
					StateCallback
				>;

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
					FacadeCommandResult
				>;
				const actor = resolveActor(adapter);
				const commandResult = commandCallback(actor);
				ensureFacadeResult(commandResult, "commands");

				const entries = Object.entries(commandResult) as Array<
					[keyof ExtractCommandResult<CommandActor, CommandCallback>, unknown]
				>;
				const commandFacade = Object.create(null) as ExtractCommandResult<
					CommandActor,
					CommandCallback
				>;

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
		},
	});
}
