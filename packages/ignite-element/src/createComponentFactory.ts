import type { IgniteAdapter, StateScope } from "ignite-core";
import type { IgniteJsxChild, RenderStrategyFactory } from "ignite-renderer";
import type { TemplateResult } from "lit-html";
import igniteElementFactory, {
	type BaseRenderArgs,
	type ComponentFactory,
} from "./IgniteElementFactory";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	FacadeViewCallback,
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

export type ElementFactoryOptions<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
> = {
	scope?: StateScope;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: HTMLElement,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	createRenderStrategy?: RenderStrategyFactory<View>;
	events?: Events;
	cleanup?: boolean;
};

export type ElementFactoryCreator<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View,
	Result,
	Events extends EventMap = EmptyEventMap,
> = (
	createAdapter: AdapterFactory<State, Event>,
	options: ElementFactoryOptions<State, Event, RenderArgs, View, Events>,
) => Result;

type FacadeStateResult<Result> = [Result] extends [Record<string, unknown>]
	? Result
	: Record<never, never>;

type ExtractCommandResult<Result> = [Result] extends [FacadeCommandResult]
	? Result
	: Record<never, never>;

type Phantom<T> = Record<never, T>;

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

export type ComponentFactoryOptions<
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
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
> = {
	scope?: StateScope;
	states?: FacadeStatesCallback<Snapshot, StatesResult>;
	view?: FacadeViewCallback<Snapshot, StatesResult>;
	commands?: FacadeCommandsCallback<CommandActor, CommandsResult>;
	resolveStateSnapshot?: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor?: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: HTMLElement,
	) => Additional;
	createRenderStrategy?: RenderStrategyFactory<View>;
	events?: Events;
	cleanup?: boolean;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isDevelopment = () => process.env.NODE_ENV !== "production";

function freezeIfDev<T extends object>(value: T): T {
	return isDevelopment() ? Object.freeze(value) : value;
}

function ensureFacadeResult(
	result: unknown,
	feature: "states" | "view" | "commands",
) {
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
export function createComponentFactoryWithRenderer<
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
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactory<
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
		View
	>,
>(
	createAdapter: AdapterFactory<State, Event>,
	elementFactory: ElementFactoryCreator<
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
		View,
		FactoryResult,
		Events
	>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): FactoryResult {
	const {
		scope,
		states,
		view,
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
	const resolvedView = view;
	const resolveView = (
		adapter: IgniteAdapter<State, Event>,
	): FacadeStateResult<StatesResult> => {
		if (resolvedView) {
			const result = resolvedView({
				snapshot: resolveSnapshot(adapter),
			});
			ensureFacadeResult(result, "view");
			return result;
		}

		if (states) {
			const result = states(resolveSnapshot(adapter));
			ensureFacadeResult(result, "states");
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

	return elementFactory(createAdapter, {
		scope: scope ?? createAdapter.scope,
		createRenderStrategy: options?.createRenderStrategy,
		cleanup: options?.cleanup,
		createAdditionalArgs: (
			adapter: IgniteAdapter<State, Event>,
			host?: HTMLElement,
		) => {
			if (!host) {
				throw new Error(
					"[createComponentFactory] Unable to resolve host element for command context.",
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

			if (resolvedView || states) {
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
					CommandsResult
				>;
				const actor = resolveActor(adapter);
				const commandResult = commandCallback({
					actor,
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
		},
	});
}

export function createComponentFactory<
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
>(
	createAdapter: AdapterFactory<State, Event>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>,
): ComponentFactory<
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
	>
> {
	return createComponentFactoryWithRenderer(
		createAdapter,
		igniteElementFactory,
		options,
	);
}
