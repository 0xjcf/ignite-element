import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	ExtendedState,
	IgniteAdapter,
	ProjectionFactory,
	XStateCommandActor,
} from "ignite-core";
import {
	igniteCore as igniteCoreProjection,
	isXStateActor,
	isXStateMachine,
	StateScope,
} from "ignite-core";
import type { InferStateAndEvent, MobxEvent } from "ignite-store";
import {
	igniteCoreMobx as igniteCoreMobxProjection,
	igniteCoreRedux as igniteCoreReduxProjection,
	isMobxObservable,
	isReduxSlice,
	isReduxStore,
} from "ignite-store";
import type { AnyStateMachine, EventFrom } from "xstate";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteRenderArgs,
} from "./IgniteElementFactory";
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
import type {
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "./RenderArgs";

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

const createDomEmit = <Events extends EventMap>(
	host: HTMLElement,
): EmitFromEvents<Events> => {
	return <Type extends keyof Events & string>(
		type: Type,
		...args: EmitPayloadArgs<Events, Type>
	) => {
		const detail = args[0];
		const customEvent = new CustomEvent(type, {
			detail,
			bubbles: true,
			composed: true,
		});
		host.dispatchEvent(customEvent);
	};
};

function bindProjectionToElements<
	State,
	Event,
	RenderArgs extends IgniteRenderArgs<State, Event>,
	Events extends EventMap,
>(
	projection: ProjectionFactory<State, Event, RenderArgs, HTMLElement, Events>,
): ComponentFactory<State, Event, RenderArgs> {
	return igniteElementFactory(projection.createAdapter, {
		scope: projection.scope,
		cleanup: projection.cleanup,
		eventTypes: projection.eventTypes,
		createAdditionalArgs: (adapter, host) => {
			if (!host) {
				throw new Error(
					"[igniteCore] Host element is required for projection.",
				);
			}
			return projection.createAdditionalArgs(
				adapter,
				host,
				createDomEmit<Events>(host),
			);
		},
	});
}

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

function isFactorySource(
	source: IgniteCoreConfig["source"],
): source is () => unknown {
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

	const adapterName = resolveAdapter(options);

	if (isXStateConfig(options, adapterName)) {
		return igniteCoreXState(options);
	}

	if (isReduxConfig(options, adapterName)) {
		return igniteCoreRedux(options);
	}

	if (isMobxConfig(options, adapterName)) {
		return igniteCoreMobx(options);
	}

	return assertNever(adapterName);
}

export function igniteCoreXState<
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
> {
	const projection = igniteCoreProjection(options);
	return bindProjectionToElements(projection) as IgniteCoreReturn<
		ExtendedState<Machine>,
		EventFrom<Machine>,
		ExtendedState<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		Events
	>;
}

export function igniteCoreRedux<
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

export function igniteCoreRedux<
	Source extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ReduxInstanceConfig<Source, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StatesResult,
	ReduxCommandActorFor<Source>,
	CommandsResult,
	Events
>;

export function igniteCoreRedux(
	options: ReduxConfig,
): IgniteCoreReturn<
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	Record<string, unknown>,
	ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
	FacadeCommandResult,
	EventMap
>;

export function igniteCoreRedux(
	options: ReduxConfig,
): IgniteCoreReturn<
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	Record<string, unknown>,
	ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
	FacadeCommandResult,
	EventMap
> {
	const projection = igniteCoreReduxProjection(options);
	return bindProjectionToElements(projection) as IgniteCoreReturn<
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		Record<string, unknown>,
		ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
		FacadeCommandResult,
		EventMap
	>;
}

export function igniteCoreMobx<
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
> {
	const projection = igniteCoreMobxProjection(options);
	return bindProjectionToElements(projection) as IgniteCoreReturn<
		State,
		MobxEvent<State>,
		State,
		StatesResult,
		State,
		CommandsResult,
		Events
	>;
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
