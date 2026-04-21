import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { InferStateAndEvent } from "ignite-adapters";
import { createReduxAdapter } from "ignite-adapters";
import type { IgniteAdapter, StateScope } from "ignite-core";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type {
	IgniteCoreReturn,
	ReduxBlueprintConfig,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceConfig,
	ReduxInstanceSource,
} from "./types";

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
	const createAdapter = createReduxAdapter(
		options.source as never,
	) as unknown as (() => IgniteAdapter<
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"]
	>) & {
		scope?: StateScope;
		resolveStateSnapshot?: (
			adapter: IgniteAdapter<
				InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
				InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"]
			>,
		) => InferStateAndEvent<
			ReduxBlueprintSource | ReduxInstanceSource
		>["State"];
		resolveCommandActor?: (
			adapter: IgniteAdapter<
				InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
				InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"]
			>,
		) => ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>;
	};

	return createIgniteComponentFactory<
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		Record<string, unknown>,
		ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
		FacadeCommandResult,
		EventMap
	>(createAdapter, options) as IgniteCoreReturn<
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
		InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
		Record<string, unknown>,
		ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
		FacadeCommandResult,
		EventMap
	>;
}
