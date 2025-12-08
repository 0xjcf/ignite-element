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
		const adapterFactory = createReduxAdapter(source);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			events: eventDefinitions,
			cleanup: options.cleanup,
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
		const adapterFactory = createReduxAdapter(source as () => EnhancedStore);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			events: eventDefinitions,
			cleanup: options.cleanup,
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
		const adapterFactory = createReduxAdapter(source as Slice);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			events: eventDefinitions,
			cleanup: options.cleanup,
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
