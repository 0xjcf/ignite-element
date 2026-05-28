import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { InferStateAndEvent, MobxEvent } from "ignite-adapters";
import { isMobxObservable, isReduxSlice, isReduxStore } from "ignite-adapters";
import type {
	ActorWebCommandActor,
	ActorWebExtendedState,
	ActorWebSource,
	ActorWebSourceHandle,
} from "ignite-adapters/actor-web";
import type { ExtendedState, XStateCommandActor } from "ignite-adapters/xstate";
import { isXStateActor, isXStateMachine } from "ignite-adapters/xstate";
import type { IgniteAdapter } from "ignite-core";
import { StateScope } from "ignite-core";
import type { AnyStateMachine, EventFrom } from "xstate";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteRenderArgs,
} from "./IgniteElementFactory";
import { igniteCoreActorWeb } from "./igniteCore/actor-web";
import { igniteCoreMobx } from "./igniteCore/mobx";
import { igniteCoreRedux } from "./igniteCore/redux";
import type {
	ActorWebConfig,
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

export type {
	ActorWebConfig,
	AnyCommandsCallback,
	AnyStatesCallback,
	IgniteCoreReturn,
	InferAdapterFromSource,
	MobxConfig,
	ReduxBlueprintConfig,
	ReduxInstanceConfig,
	XStateConfig,
} from "./igniteCore/types";

type ReduxConfig =
	| ReduxBlueprintConfig<
			() => EnhancedStore,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult
	  >
	| ReduxBlueprintConfig<
			Slice,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult
	  >
	| ReduxInstanceConfig<
			ReduxInstanceSource,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult
	  >;

type XStateConfigBase = XStateConfig<AnyStateMachine, EventMap>;
type ActorWebConfigBase = ActorWebConfig<
	object,
	{ type: string },
	{ type: string },
	EventMap
>;
type AnyActorWebHostContextSource = (context: {
	host?: HTMLElement;
}) => unknown;
type ActorWebSourceResult<Source> = Source extends (context: {
	host?: HTMLElement;
}) => infer Result
	? Result
	: never;
type ActorWebSourceContext<Source> =
	ActorWebSourceResult<Source> extends ActorWebSource<
		infer SourceContext,
		infer _SourceMessage,
		infer _SourceEmitted
	>
		? SourceContext
		: ActorWebSourceResult<Source> extends ActorWebSourceHandle<
					infer HandleContext,
					infer _HandleMessage,
					infer _HandleEmitted
				>
			? HandleContext
			: never;
type ActorWebSourceMessage<Source> =
	ActorWebSourceResult<Source> extends ActorWebSource<
		infer _SourceContext,
		infer SourceMessage,
		infer _SourceEmitted
	>
		? SourceMessage
		: ActorWebSourceResult<Source> extends ActorWebSourceHandle<
					infer _HandleContext,
					infer HandleMessage,
					infer _HandleEmitted
				>
			? HandleMessage
			: never;
type ActorWebSourceEmitted<Source> =
	ActorWebSourceResult<Source> extends ActorWebSource<
		infer _SourceContext,
		infer _SourceMessage,
		infer SourceEmitted
	>
		? SourceEmitted
		: ActorWebSourceResult<Source> extends ActorWebSourceHandle<
					infer _HandleContext,
					infer _HandleMessage,
					infer HandleEmitted
				>
			? HandleEmitted
			: never;

function isXStateConfig(
	options: IgniteCoreConfig,
	adapter: ResolvedAdapter,
): options is XStateConfigBase {
	if (options.adapter) {
		return options.adapter === "xstate";
	}

	return adapter === "xstate";
}

function isReduxConfig(
	options: IgniteCoreConfig,
	adapter: ResolvedAdapter,
): options is ReduxConfig {
	if (options.adapter) {
		return options.adapter === "redux";
	}

	return adapter === "redux";
}

function isMobxConfig(
	options: IgniteCoreConfig,
	adapter: ResolvedAdapter,
): options is MobxConfig<object, EventMap> {
	if (options.adapter) {
		return options.adapter === "mobx";
	}

	return adapter === "mobx";
}

function isActorWebConfig(
	options: IgniteCoreConfig,
	adapter: ResolvedAdapter,
): options is ActorWebConfigBase {
	if (options.adapter) {
		return options.adapter === "actor-web";
	}

	return adapter === "actor-web";
}

function isFactorySource(
	source: IgniteCoreConfig["source"],
): source is (context?: { host?: HTMLElement }) => unknown {
	return typeof source === "function";
}

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
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ActorWebConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>,
): IgniteCoreReturn<
	ActorWebExtendedState<Context>,
	Message,
	ActorWebExtendedState<Context>,
	StatesResult,
	ActorWebCommandActor<Context, Message, Emitted>,
	CommandsResult,
	Events
>;

export function igniteCore<
	Source extends AnyActorWebHostContextSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: Omit<
		ActorWebConfig<
			ActorWebSourceContext<Source>,
			ActorWebSourceMessage<Source>,
			ActorWebSourceEmitted<Source>,
			Events,
			StatesResult,
			CommandsResult,
			ActorWebSource<
				ActorWebSourceContext<Source>,
				ActorWebSourceMessage<Source>,
				ActorWebSourceEmitted<Source>
			>
		>,
		"adapter" | "source"
	> & {
		adapter?: undefined;
		source: Source &
			(undefined extends Parameters<Source>[0] ? never : unknown);
	},
): IgniteCoreReturn<
	ActorWebExtendedState<ActorWebSourceContext<Source>>,
	ActorWebSourceMessage<Source>,
	ActorWebExtendedState<ActorWebSourceContext<Source>>,
	StatesResult,
	ActorWebCommandActor<
		ActorWebSourceContext<Source>,
		ActorWebSourceMessage<Source>,
		ActorWebSourceEmitted<Source>
	>,
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

export function igniteCore(
	options?: IgniteCoreConfig | { adapter?: ResolvedAdapter; source: unknown },
) {
	if (typeof options === "undefined") {
		type StaticState = Record<string, never>;
		const staticState: StaticState = {};
		const createStaticAdapter = Object.assign(
			(): IgniteAdapter<StaticState, never> => ({
				scope: StateScope.Shared,
				subscribe(listener: (state: StaticState) => void) {
					listener(staticState);
					return { unsubscribe() {} };
				},
				send() {},
				getState() {
					return staticState;
				},
				stop() {},
			}),
			{ scope: StateScope.Shared },
		);

		return igniteElementFactory<StaticState, never>(createStaticAdapter);
	}

	const config = options as IgniteCoreConfig;
	const adapterName = resolveAdapter(config);

	if (isXStateConfig(config, adapterName)) {
		return igniteCoreXState(config);
	}

	if (isReduxConfig(config, adapterName)) {
		return igniteCoreRedux(config);
	}

	if (isMobxConfig(config, adapterName)) {
		return igniteCoreMobx(config);
	}

	if (isActorWebConfig(config, adapterName)) {
		return igniteCoreActorWeb(config);
	}

	return assertNever(adapterName);
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

	if (isFactorySource(source)) {
		const inferred = inferFromFactory(source);
		if (inferred) {
			return inferred;
		}
	}

	if (isActorWebSource(source) || isActorWebSourceHandle(source)) {
		return "actor-web";
	}

	if (isMobxObservable(source)) {
		return "mobx";
	}

	throw new Error(
		"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
	);
}

function inferFromFactory(
	factory: (context?: { host?: HTMLElement }) => unknown,
): Extract<ResolvedAdapter, "actor-web"> | undefined {
	if (factory.length > 0) {
		return "actor-web";
	}

	return undefined;
}

function isActorWebSource(
	value: unknown,
): value is ActorWebSource<object, { type: string }, { type: string }> {
	return (
		typeof value === "object" &&
		value !== null &&
		"snapshot" in value &&
		"subscribe" in value
	);
}

function isActorWebSourceHandle(
	value: unknown,
): value is ActorWebSourceHandle<object, { type: string }, { type: string }> {
	return (
		typeof value === "object" &&
		value !== null &&
		"source" in value &&
		isActorWebSource((value as { source?: unknown }).source)
	);
}

function assertNever(adapter: unknown): never {
	throw new Error(`Unsupported adapter: ${String(adapter)}`);
}
