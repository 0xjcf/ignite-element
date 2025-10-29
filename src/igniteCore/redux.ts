import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import createReduxAdapter from "../adapters/ReduxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
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
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<Source>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
> = Source extends ReduxInstanceSource
	? ReduxInstanceConfig<Source, Events, StateCallback, CommandCallback>
	: Source extends ReduxBlueprintSource
		? ReduxBlueprintConfig<Source, Events, StateCallback, CommandCallback>
		: never;

export function igniteCoreRedux<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<Source>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
>(
	options: ReduxConfigFor<Source, Events, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback,
	Events
> {
	return createReduxComponentFactory(options);
}

function createReduxComponentFactory<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined = undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<Source>,
				FacadeCommandResult,
				Events
		  >
		| undefined = undefined,
>(
	options: ReduxConfigFor<Source, Events, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback,
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
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback,
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
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback,
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
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback,
			Events
		>;
	}

	throw new Error(
		"[igniteCore] Unable to resolve redux source; please specify the adapter explicitly.",
	);
}
