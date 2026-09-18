import type { InferStateAndEvent } from "@ignite-element/adapters/redux";
import {
	createReduxAdapter,
	isReduxSlice,
	isReduxStore,
} from "@ignite-element/adapters/redux";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	IgniteAdapter,
	StateScope,
} from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import { assertSupportedSourceOptions } from "../internal/assertSupportedSourceOptions";
import {
	createIgniteComponentFactory,
	type IgniteComponentFactoryOptions,
} from "./createIgniteComponentFactory";
import type { DisjointBindings } from "./publicTypes";
import type {
	IgniteCoreReturn,
	ReduxBlueprintConfig,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceConfig,
	ReduxInstanceSource,
} from "./reduxTypes";

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

type ReduxSource = ReduxBlueprintSource | ReduxInstanceSource;

type ReduxState = InferStateAndEvent<ReduxSource>["State"];
type ReduxEvent = InferStateAndEvent<ReduxSource>["Event"];
type ReduxActor = ReduxCommandActorFor<ReduxSource>;

type ReduxAdapterFactory = (() => IgniteAdapter<ReduxState, ReduxEvent>) & {
	scope?: StateScope;
	resolveStateSnapshot: (
		adapter: IgniteAdapter<ReduxState, ReduxEvent>,
	) => ReduxState;
	resolveCommandActor: (
		adapter: IgniteAdapter<ReduxState, ReduxEvent>,
	) => ReduxActor;
};

function createReduxAdapterFactory(source: ReduxSource): ReduxAdapterFactory {
	if (typeof source === "function") {
		return createReduxAdapter(source) as ReduxAdapterFactory;
	}

	if (isReduxStore(source)) {
		return createReduxAdapter(source) as ReduxAdapterFactory;
	}

	if (isReduxSlice(source)) {
		return createReduxAdapter(source) as ReduxAdapterFactory;
	}

	throw new TypeError("[igniteCoreRedux] Unsupported Redux source.");
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

// Keep internal union-source dispatch without an unchecked public escape hatch.
export function igniteCoreRedux<Config extends ReduxConfig>(
	options: Config &
		("cleanup" extends keyof Config ? never : unknown) &
		DisjointBindings<
			NoInfer<
				Config extends {
					states: (...args: never[]) => infer States extends object;
				}
					? States
					: Record<never, never>
			>,
			NoInfer<
				Config extends {
					commands: (...args: never[]) => infer Commands extends object;
				}
					? Commands
					: Record<never, never>
			>
		>,
): IgniteCoreReturn<
	ReduxState,
	ReduxEvent,
	ReduxState,
	Record<string, unknown>,
	ReduxActor,
	FacadeCommandResult,
	EventMap
>;

export function igniteCoreRedux(
	options: ReduxConfig,
): IgniteCoreReturn<
	ReduxState,
	ReduxEvent,
	ReduxState,
	Record<string, unknown>,
	ReduxActor,
	FacadeCommandResult,
	EventMap
> {
	assertSupportedSourceOptions(options);
	const createAdapter = createReduxAdapterFactory(options.source);
	const componentOptions = options as unknown as IgniteComponentFactoryOptions<
		ReduxState,
		ReduxActor,
		Record<string, unknown>,
		FacadeCommandResult,
		EventMap
	>;

	return createIgniteComponentFactory<
		ReduxState,
		ReduxEvent,
		ReduxState,
		Record<string, unknown>,
		ReduxActor,
		FacadeCommandResult,
		EventMap
	>(createAdapter, componentOptions, createAdapter);
}
