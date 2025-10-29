import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import type { StateScope } from "./IgniteAdapter";
import igniteElementFactory, {
	type BaseRenderArgs,
	type ComponentFactory,
} from "./IgniteElementFactory";
import type {
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "./RenderArgs";
import type { IgniteJsxChild } from "./renderers/jsx/types";
import type { RenderStrategyFactory } from "./renderers/RenderStrategy";

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

type FacadeStateResult<Snapshot, Callback> = [Callback] extends [
	FacadeStatesCallback<Snapshot, infer Result>,
]
	? Result
	: Record<never, never>;

type ExtractCommandResult<Actor, Events extends EventMap, Callback> = [
	Callback,
] extends [FacadeCommandsCallback<Actor, infer Result, Events>]
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
	Events extends EventMap = EmptyEventMap,
> = BaseRenderArgs<State, Event> &
	Additional &
	FacadeStateResult<Snapshot, StateCallback> &
	ExtractCommandResult<CommandActor, Events, CommandCallback>;

export type ComponentFactoryOptions<
	State,
	Event,
	Snapshot,
	StateCallback,
	CommandActor,
	CommandCallback,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
> = {
	scope?: StateScope;
	states?: StateCallback;
	commands?: CommandCallback;
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
export function createComponentFactoryWithRenderer<
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
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	CommandCallback extends
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult, Events>
		| undefined = undefined,
	FactoryResult = ComponentFactory<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			Snapshot,
			StateCallback,
			CommandActor,
			CommandCallback,
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
			Snapshot,
			StateCallback,
			CommandActor,
			CommandCallback,
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
		StateCallback,
		CommandActor,
		CommandCallback,
		Additional,
		View,
		Events
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
		Additional,
		Events
	>;

	const eventDefinitions = events ?? (Object.create(null) as Events);

	const createEmit = (host: HTMLElement): EmitFromEvents<Events> =>
		((type: keyof Events & string, detail: unknown) => {
			if (isDevelopment()) {
				if (!(type in eventDefinitions)) {
					throw new Error(
						`[createComponentFactory] Unknown event "${type}". Declare it in the events map before emitting.`,
					);
				}
			}

			const customEvent = new CustomEvent(type, {
				detail,
				bubbles: true,
				composed: true,
			});
			host.dispatchEvent(customEvent);
		}) as EmitFromEvents<Events>;

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
					FacadeCommandResult,
					Events
				>;
				const actor = resolveActor(adapter);
				const emit = createEmit(host);
				const commandResult = commandCallback({
					actor,
					emit,
					host,
				});
				ensureFacadeResult(commandResult, "commands");

				const entries = Object.entries(commandResult) as Array<
					[
						keyof ExtractCommandResult<CommandActor, Events, CommandCallback>,
						unknown,
					]
				>;
				const commandFacade = Object.create(null) as ExtractCommandResult<
					CommandActor,
					Events,
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
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult, Events>
		| undefined = undefined,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: AdapterFactory<State, Event>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
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
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback,
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
