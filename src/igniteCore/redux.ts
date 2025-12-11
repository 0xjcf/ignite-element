import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import createReduxAdapter from "../adapters/ReduxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
} from "../RenderArgs";
import { isReduxSlice, isReduxStore } from "../utils/adapterGuards";
import type { InferStateAndEvent } from "../utils/igniteRedux";
import type {
	IgniteCoreReturn,
	ReduxBlueprintConfig,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceConfig,
	ReduxInstanceSource,
} from "./types";

type ReduxConfigFor<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
> = Source extends ReduxInstanceSource
	? ReduxInstanceConfig<Source, Events, StatesResult, CommandsResult>
	: Source extends ReduxBlueprintSource
		? ReduxBlueprintConfig<Source, Events, StatesResult, CommandsResult>
		: never;

export function igniteCoreRedux<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ReduxConfigFor<Source, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StatesResult,
	ReduxCommandActorFor<Source>,
	CommandsResult,
	Events
> {
	return createReduxComponentFactory(options);
}

function createReduxComponentFactory<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends Record<never, FacadeCommandFunction> = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ReduxConfigFor<Source, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StatesResult,
	ReduxCommandActorFor<Source>,
	CommandsResult,
	Events
> {
	const eventDefinitions = options.events?.(event);
	const { source } = options;

	if (isReduxStore(source)) {
		const storeOptions = options as ReduxInstanceConfig<
			EnhancedStore,
			Events,
			StatesResult,
			CommandsResult
		>;
		const adapterFactory = createReduxAdapter(storeOptions.source);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: storeOptions.states,
			commands: storeOptions.commands,
			events: eventDefinitions,
			cleanup: storeOptions.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StatesResult,
			ReduxCommandActorFor<Source>,
			CommandsResult,
			Events
		>;
	}

	if (typeof source === "function") {
		const factoryOptions = options as ReduxBlueprintConfig<
			() => EnhancedStore,
			Events,
			StatesResult,
			CommandsResult
		>;
		const adapterFactory = createReduxAdapter(factoryOptions.source);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: factoryOptions.states,
			commands: factoryOptions.commands,
			events: eventDefinitions,
			cleanup: factoryOptions.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StatesResult,
			ReduxCommandActorFor<Source>,
			CommandsResult,
			Events
		>;
	}

	if (isReduxSlice(source)) {
		const sliceOptions = options as ReduxBlueprintConfig<
			Slice,
			Events,
			StatesResult,
			CommandsResult
		>;
		const adapterFactory = createReduxAdapter(sliceOptions.source);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: sliceOptions.states,
			commands: sliceOptions.commands,
			events: eventDefinitions,
			cleanup: sliceOptions.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StatesResult,
			ReduxCommandActorFor<Source>,
			CommandsResult,
			Events
		>;
	}

	throw new Error(
		"[igniteCore] Unable to resolve redux source; please specify the adapter explicitly.",
	);
}
