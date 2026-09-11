import type {
	ActorWebReadModelSource,
	ActorWebSource,
} from "@ignite-element/adapters/actor-web";
import type { XStateActorInstance } from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";
import type { ActorWebConfig } from "./actorWebTypes";
import type { MobxConfig } from "./mobxTypes";
import type {
	ReduxBlueprintConfig,
	ReduxInstanceConfig,
	ReduxInstanceSource,
} from "./reduxTypes";
import type { XStateConfig } from "./xstateTypes";

export type {
	ActorWebCommandActor,
	ActorWebExtendedState,
	ActorWebSource,
} from "@ignite-element/adapters/actor-web";
export type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyStatesCallback,
	EventsDefinition,
} from "@ignite-element/core";
export type * from "./actorWebTypes";
export type * from "./mobxTypes";
export type * from "./publicTypes";
export type * from "./reduxTypes";
export type * from "./xstateTypes";
export type InferAdapterFromSource<Source> = Source extends AnyStateMachine
	? "xstate"
	: Source extends XStateActorInstance<AnyStateMachine>
		? "xstate"
		: Source extends (...args: never[]) => unknown
			? never
			: Source extends EnhancedStore
				? "redux"
				: Source extends Slice
					? "redux"
					: Source extends ActorWebSource<
								infer _SourceContext,
								infer _SourceMessage,
								infer _SourceEmitted
							>
						? "actor-web"
						: Source extends ActorWebReadModelSource<
									infer _ReadModelContext,
									infer _ReadModelMessage,
									infer _ReadModelEmitted
								>
							? "actor-web"
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
	| MobxConfig<object, EventMap, Record<string, unknown>, FacadeCommandResult>
	| ActorWebConfig<
			object,
			{ type: string },
			{ type: string },
			EventMap,
			Record<string, unknown>,
			FacadeCommandResult
	  >;

export type ResolvedAdapter = "xstate" | "redux" | "mobx" | "actor-web";

export type { EmptyEventMap, EventMap };
