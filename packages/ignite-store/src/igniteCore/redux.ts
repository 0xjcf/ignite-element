import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	IgniteCoreReturn,
} from "ignite-core";
import { createProjectionFactory, event } from "ignite-core";
import createReduxAdapter from "../adapters/ReduxAdapter";
import type {
	ReduxBlueprintConfig,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceConfig,
	ReduxInstanceSource,
} from "../types";
import { isReduxSlice, isReduxStore } from "../utils/adapterGuards";
import type { InferStateAndEvent } from "../utils/igniteRedux";

type ReduxCoreOptions<Host = unknown> =
	| ReduxBlueprintConfig<
			() => EnhancedStore,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult,
			Host
	  >
	| ReduxInstanceConfig<
			ReduxInstanceSource,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult,
			Host
	  >
	| ReduxBlueprintConfig<
			Slice,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult,
			Host
	  >;

function hasReduxStoreSource<Host>(
	options: ReduxCoreOptions<Host>,
): options is ReduxInstanceConfig<
	ReduxInstanceSource,
	EventMap,
	Record<string, unknown>,
	FacadeCommandResult,
	Host
> {
	return isReduxStore(options.source);
}

function hasReduxFactorySource<Host>(
	options: ReduxCoreOptions<Host>,
): options is ReduxBlueprintConfig<
	() => EnhancedStore,
	EventMap,
	Record<string, unknown>,
	FacadeCommandResult,
	Host
> {
	return typeof options.source === "function";
}

function hasReduxSliceSource<Host>(
	options: ReduxCoreOptions<Host>,
): options is ReduxBlueprintConfig<
	Slice,
	EventMap,
	Record<string, unknown>,
	FacadeCommandResult,
	Host
> {
	return isReduxSlice(options.source);
}

export function igniteCoreRedux<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: ReduxBlueprintConfig<
		Source,
		Events,
		StatesResult,
		CommandsResult,
		Host
	>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StatesResult,
	ReduxCommandActorFor<Source>,
	CommandsResult,
	Events,
	Host
>;

export function igniteCoreRedux<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: ReduxInstanceConfig<
		StoreInstance,
		Events,
		StatesResult,
		CommandsResult,
		Host
	>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StatesResult,
	ReduxCommandActorFor<StoreInstance>,
	CommandsResult,
	Events,
	Host
>;

export function igniteCoreRedux<Host = unknown>(
	options: ReduxCoreOptions<Host>,
): IgniteCoreReturn<
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["Event"],
	InferStateAndEvent<ReduxBlueprintSource | ReduxInstanceSource>["State"],
	Record<string, unknown>,
	ReduxCommandActorFor<ReduxBlueprintSource | ReduxInstanceSource>,
	FacadeCommandResult,
	EventMap,
	Host
>;

export function igniteCoreRedux<Host = unknown>(
	options: ReduxCoreOptions<Host>,
) {
	if (hasReduxStoreSource(options)) {
		return createReduxStoreProjection(options);
	}

	if (hasReduxFactorySource(options)) {
		return createReduxFactoryProjection(options);
	}

	if (hasReduxSliceSource(options)) {
		return createReduxSliceProjection(options);
	}

	throw new Error(
		"[igniteCore] Unable to resolve redux source; please specify the adapter explicitly.",
	);
}

function createReduxStoreProjection<
	StoreInstance extends EnhancedStore,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: ReduxInstanceConfig<
		StoreInstance,
		Events,
		StatesResult,
		CommandsResult,
		Host
	>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StatesResult,
	ReduxCommandActorFor<StoreInstance>,
	CommandsResult,
	Events,
	Host
> {
	const eventDefinitions = options.events?.(event);
	const adapterFactory = createReduxAdapter(options.source);
	return createProjectionFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
		cleanup: options.cleanup,
	});
}

function createReduxFactoryProjection<
	Factory extends () => EnhancedStore,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: ReduxBlueprintConfig<
		Factory,
		Events,
		StatesResult,
		CommandsResult,
		Host
	>,
): IgniteCoreReturn<
	InferStateAndEvent<Factory>["State"],
	InferStateAndEvent<Factory>["Event"],
	InferStateAndEvent<Factory>["State"],
	StatesResult,
	ReduxCommandActorFor<Factory>,
	CommandsResult,
	Events,
	Host
> {
	const eventDefinitions = options.events?.(event);
	const adapterFactory = createReduxAdapter(options.source);
	return createProjectionFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
		cleanup: options.cleanup,
	});
}

function createReduxSliceProjection<
	SliceSource extends Slice,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
>(
	options: ReduxBlueprintConfig<
		SliceSource,
		Events,
		StatesResult,
		CommandsResult,
		Host
	>,
): IgniteCoreReturn<
	InferStateAndEvent<SliceSource>["State"],
	InferStateAndEvent<SliceSource>["Event"],
	InferStateAndEvent<SliceSource>["State"],
	StatesResult,
	ReduxCommandActorFor<SliceSource>,
	CommandsResult,
	Events,
	Host
> {
	const eventDefinitions = options.events?.(event);
	const adapterFactory = createReduxAdapter(options.source);
	return createProjectionFactory(adapterFactory, {
		scope: adapterFactory.scope,
		states: options.states,
		commands: options.commands,
		effects: options.effects,
		events: eventDefinitions,
		cleanup: options.cleanup,
	});
}
