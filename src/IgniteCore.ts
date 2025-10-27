import type { AnyStateMachine, EventFrom } from "xstate";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateActorInstance,
} from "./adapters/XStateAdapter";
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
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
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

export function igniteCore<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined,
>(
	options: XStateConfig<Machine, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StateCallback,
	XStateActorInstance<Machine>,
	CommandCallback
>;

export function igniteCore<
	Source extends ReduxBlueprintSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<ReduxCommandActorFor<Source>, FacadeCommandResult>
		| undefined,
>(
	options: ReduxBlueprintConfig<Source, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback
>;

export function igniteCore<
	StoreInstance extends ReduxInstanceSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<StoreInstance>,
				FacadeCommandResult
		  >
		| undefined,
>(
	options: ReduxInstanceConfig<StoreInstance, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StateCallback,
	ReduxCommandActorFor<StoreInstance>,
	CommandCallback
>;

export function igniteCore<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined,
>(
	options: MobxConfig<State, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StateCallback,
	State,
	CommandCallback
>;

export function igniteCore(options: IgniteCoreConfig) {
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
