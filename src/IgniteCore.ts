import type { AnyStateMachine, EventFrom } from "xstate";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateCommandActor,
} from "./adapters/XStateAdapter";
import type IgniteAdapter from "./IgniteAdapter";
import { StateScope } from "./IgniteAdapter";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteRenderArgs,
} from "./IgniteElementFactory";
import { igniteCoreMobx } from "./igniteCore/mobx";
import { igniteCoreRedux } from "./igniteCore/redux";
import type {
	IgniteCoreConfig,
	IgniteCoreReturn,
	MobxConfig,
	ReduxBlueprintConfig,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceConfig,
	ReduxInstanceSource,
	ResolvedAdapter,
	XStateConfig,
} from "./igniteCore/types";
import { igniteCoreXState } from "./igniteCore/xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "./RenderArgs";
import {
	isReduxSlice,
	isReduxStore,
	isXStateActor,
	isXStateMachine,
} from "./utils/adapterGuards";
import type { InferStateAndEvent } from "./utils/igniteRedux";
import { isMobxObservable } from "./utils/mobxGuards";

export type {
	AnyCommandsCallback,
	AnyStatesCallback,
	IgniteCoreReturn,
	InferAdapterFromSource,
	MobxConfig,
	ReduxBlueprintConfig,
	ReduxInstanceConfig,
	XStateConfig,
} from "./igniteCore/types";

export { igniteCoreMobx, igniteCoreRedux, igniteCoreXState };

export function igniteCore(): ComponentFactory<
	Record<string, never>,
	never,
	IgniteRenderArgs<Record<string, never>, never>
>;

export function igniteCore<
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
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	Events
>;

export function igniteCore<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ReduxBlueprintConfig<Source, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StatesResult,
	ReduxCommandActorFor<Source>,
	CommandsResult,
	Events
>;

export function igniteCore<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ReduxInstanceConfig<
		StoreInstance,
		Events,
		StatesResult,
		CommandsResult
	>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StatesResult,
	ReduxCommandActorFor<StoreInstance>,
	CommandsResult,
	Events
>;

export function igniteCore<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events
>;

export function igniteCore(options?: IgniteCoreConfig) {
	if (typeof options === "undefined") {
		type StaticState = Record<string, never>;
		const staticState: StaticState = {};
		const createStaticAdapter = Object.assign(
			(): IgniteAdapter<StaticState, never> => ({
				scope: StateScope.Shared,
				subscribe(listener) {
					listener(staticState);
					return { unsubscribe() {} };
				},
				send() {},
				getState() {
					return staticState;
				},
				stop() {},
			}),
			{ scope: StateScope.Shared as const },
		);

		return igniteElementFactory<StaticState, never>(createStaticAdapter);
	}

	const adapterName = resolveAdapter(options);

	switch (adapterName) {
		case "xstate":
			return igniteCoreXState(
				options as Parameters<typeof igniteCoreXState>[0],
			);
		case "redux":
			return igniteCoreRedux(options as Parameters<typeof igniteCoreRedux>[0]);
		case "mobx":
			return igniteCoreMobx(options as Parameters<typeof igniteCoreMobx>[0]);
		default:
			return assertNever(adapterName);
	}
}

function resolveAdapter(options: IgniteCoreConfig): ResolvedAdapter {
	if (options.adapter) {
		return options.adapter;
	}

	const { source } = options;

	if (isXStateActor(source) || isXStateMachine(source)) {
		return "xstate";
	}

	if (isReduxStore(source) || isReduxSlice(source)) {
		return "redux";
	}

	if (typeof source === "function") {
		const inferred = inferFromFactory(source as () => unknown);
		if (inferred) {
			return inferred;
		}
	}

	if (isMobxObservable(source)) {
		return "mobx";
	}

	throw new Error(
		"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
	);
}

function inferFromFactory(
	factory: () => unknown,
): Extract<ResolvedAdapter, "redux" | "mobx"> | undefined {
	try {
		const candidate = factory();
		if (isReduxStore(candidate)) {
			return "redux";
		}
		if (isMobxObservable(candidate)) {
			return "mobx";
		}
	} catch (error) {
		throw new Error(
			`[igniteCore] Failed to execute source factory while inferring adapter. Specify the adapter explicitly. Original error: ${String(
				error,
			)}`,
		);
	}

	return undefined;
}

function assertNever(adapter: unknown): never {
	throw new Error(`Unsupported adapter: ${String(adapter)}`);
}

export type { ResolvedAdapter } from "./igniteCore/types";
