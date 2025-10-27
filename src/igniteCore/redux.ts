import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import createReduxAdapter from "../adapters/ReduxAdapter";
import { createComponentFactory } from "../createComponentFactory";
import type {
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
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<ReduxCommandActorFor<Source>, FacadeCommandResult>
		| undefined,
> = Source extends ReduxInstanceSource
	? ReduxInstanceConfig<Source, StateCallback, CommandCallback>
	: Source extends ReduxBlueprintSource
		? ReduxBlueprintConfig<Source, StateCallback, CommandCallback>
		: never;

export function igniteCoreRedux<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
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
	options: ReduxConfigFor<Source, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback
> {
	return createReduxComponentFactory(options);
}

function createReduxComponentFactory<
	Source extends ReduxBlueprintSource | ReduxInstanceSource,
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
	options: ReduxConfigFor<Source, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback
> {
	const { source } = options;

	if (isReduxStore(source)) {
		const adapterFactory = createReduxAdapter(source);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			cleanup: options.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback
		>;
	}

	if (typeof source === "function") {
		const adapterFactory = createReduxAdapter(source as () => EnhancedStore);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			cleanup: options.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback
		>;
	}

	if (isReduxSlice(source)) {
		const adapterFactory = createReduxAdapter(source as Slice);
		return createComponentFactory(adapterFactory, {
			scope: adapterFactory.scope,
			states: options.states,
			commands: options.commands,
			cleanup: options.cleanup,
		}) as IgniteCoreReturn<
			InferStateAndEvent<Source>["State"],
			InferStateAndEvent<Source>["Event"],
			InferStateAndEvent<Source>["State"],
			StateCallback,
			ReduxCommandActorFor<Source>,
			CommandCallback
		>;
	}

	throw new Error(
		"[igniteCore] Unable to resolve redux source; please specify the adapter explicitly.",
	);
}
