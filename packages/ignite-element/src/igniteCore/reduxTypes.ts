import type {
	ReduxBlueprintSource,
	ReduxInstanceSource,
	ReduxBlueprintConfig as StoreReduxBlueprintConfig,
	ReduxInstanceConfig as StoreReduxInstanceConfig,
} from "@ignite-element/adapters/redux";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";

export type {
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceSource,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "@ignite-element/adapters/redux";
export type { IgniteCoreReturn } from "./publicTypes";

import type { DisjointBindings } from "./publicTypes";

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = StoreReduxBlueprintConfig<
	Source,
	Events,
	StatesResult,
	CommandsResult,
	unknown
> &
	DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;

export type ReduxInstanceConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = StoreReduxInstanceConfig<
	StoreInstance,
	Events,
	StatesResult,
	CommandsResult,
	unknown
> &
	DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;
