import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	MobxEvent,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceSource,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
	MobxConfig as StoreMobxConfig,
	ReduxBlueprintConfig as StoreReduxBlueprintConfig,
	ReduxInstanceConfig as StoreReduxInstanceConfig,
} from "ignite-adapters";
import type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyStatesCallback,
	AnyViewCallback,
	XStateConfig as CoreXStateConfig,
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	WithFacadeRenderArgs,
	XStateActorInstance,
} from "ignite-core";
import type { AnyStateMachine } from "xstate";
import type { ComponentFactory } from "../IgniteElementFactory";
import type { IgniteAgentRuntime } from "../types/agent";
import type { IgniteSchemaValue } from "../types/schema";

export type IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = unknown,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Events extends EventMap = EmptyEventMap,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		Events
	> &
		Record<never, Snapshot>
> &
	IgniteAgentRuntime<
		Snapshot,
		CommandsResult,
		Events,
		IgniteSchemaValue,
		StatesResult
	>;
export type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyStatesCallback,
	AnyViewCallback,
	EventsDefinition,
	MobxEvent,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceSource,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
};

export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = CoreXStateConfig<
	Machine,
	Events,
	StatesResult,
	CommandsResult,
	HTMLElement
>;

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
	HTMLElement
>;

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
	HTMLElement
>;

export type MobxConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = StoreMobxConfig<State, Events, StatesResult, CommandsResult, HTMLElement>;

export type InferAdapterFromSource<Source> = Source extends AnyStateMachine
	? "xstate"
	: Source extends XStateActorInstance<AnyStateMachine>
		? "xstate"
		: Source extends () => infer Result
			? Result extends EnhancedStore
				? "redux"
				: Result extends object
					? "mobx"
					: never
			: Source extends EnhancedStore
				? "redux"
				: Source extends Slice
					? "redux"
					: Source extends object
						? "mobx"
						: never;

export type IgniteCoreConfig =
	| XStateConfig<
			AnyStateMachine,
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
	  >
	| ReduxBlueprintConfig<
			() => EnhancedStore,
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult
	  >
	| MobxConfig<object, EventMap, Record<string, unknown>, FacadeCommandResult>;

export type ResolvedAdapter = "xstate" | "redux" | "mobx";

export type { EmptyEventMap, EventMap };
