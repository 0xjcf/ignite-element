import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	ActorWebCommandActor,
	ActorWebExtendedState,
	ActorWebSource,
	ActorWebSourceHandle,
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
	XStateConfig as AdapterXStateConfig,
	XStateActorInstance,
} from "ignite-adapters/xstate";
import type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyStatesCallback,
	AnyViewCallback,
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
	FacadeViewCallback,
} from "ignite-core";
import type { AnyStateMachine } from "xstate";
import type { WithFacadeRenderArgs } from "../createProjectionFactory";
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
	ActorWebCommandActor,
	ActorWebExtendedState,
	ActorWebSource,
	ActorWebSourceHandle,
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
> = AdapterXStateConfig<
	Machine,
	Events,
	StatesResult,
	CommandsResult,
	HTMLElement
>;

type AdapterConfigSource<
	Adapter extends ResolvedAdapter,
	Source,
> = Source extends (...args: unknown[]) => unknown
	? {
			adapter: Adapter;
			source: Source;
		}
	: {
			adapter?: Adapter;
			source: Source;
		};

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Omit<
	StoreReduxBlueprintConfig<
		Source,
		Events,
		StatesResult,
		CommandsResult,
		HTMLElement
	>,
	"adapter" | "source"
> &
	AdapterConfigSource<"redux", Source>;

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
> = Omit<
	StoreMobxConfig<State, Events, StatesResult, CommandsResult, HTMLElement>,
	"adapter" | "source"
> &
	(
		| {
				adapter: "mobx";
				source: () => State;
		  }
		| {
				adapter?: "mobx";
				source: State extends (...args: unknown[]) => unknown ? never : State;
		  }
	);

type ActorWebSourceValue<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebSourceHandle<Context, Message, Emitted>;

type ActorWebHostContextFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = {
	bivarianceHack(context?: {
		host?: HTMLElement;
	}): ActorWebSourceValue<Context, Message, Emitted>;
}["bivarianceHack"];

export type ActorWebSourceLike<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSourceValue<Context, Message, Emitted>
	| (() => ActorWebSourceValue<Context, Message, Emitted>)
	| ActorWebHostContextFactory<Context, Message, Emitted>;

export type ActorWebConfig<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Source extends ActorWebSourceLike<
		Context,
		Message,
		Emitted
	> = ActorWebSourceLike<Context, Message, Emitted>,
> = {
	states?: FacadeStatesCallback<ActorWebExtendedState<Context>, StatesResult>;
	view?: FacadeViewCallback<ActorWebExtendedState<Context>, StatesResult>;
	commands?: FacadeCommandsCallback<
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		HTMLElement
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
} & (
	| {
			effects?: FacadeEffectsCallback<
				ActorWebExtendedState<Context>,
				ActorWebCommandActor<Context, Message, Emitted>,
				Events,
				HTMLElement
			>;
	  }
	| {
			effects?: FacadeEffectsObjectCallback<
				ActorWebExtendedState<Context>,
				ActorWebCommandActor<Context, Message, Emitted>,
				Events,
				HTMLElement
			>;
	  }
) &
	ActorWebConfigSource<Context, Message, Emitted, Source>;

type ActorWebConfigSource<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
	Source extends ActorWebSourceLike<Context, Message, Emitted>,
> = Source extends (...args: infer Args) => unknown
	? Args extends []
		? {
				adapter: "actor-web";
				source: Source;
			}
		: undefined extends Args[0]
			? {
					adapter: "actor-web";
					source: Source;
				}
			: {
					adapter?: "actor-web";
					source: Source;
				}
	: {
			adapter?: "actor-web";
			source: Source;
		};

export type InferAdapterFromSource<Source> = Source extends AnyStateMachine
	? "xstate"
	: Source extends XStateActorInstance<AnyStateMachine>
		? "xstate"
		: Source extends (...args: infer Args) => infer Result
			? Args extends []
				? never
				: undefined extends Args[0]
					? never
					: Args[0] extends { host?: HTMLElement }
						? Result extends ActorWebSource<
								infer _ResultContext,
								infer _ResultMessage,
								infer _ResultEmitted
							>
							? "actor-web"
							: Result extends ActorWebSourceHandle<
										infer _ResultHandleContext,
										infer _ResultHandleMessage,
										infer _ResultHandleEmitted
									>
								? "actor-web"
								: never
						: never
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
						: Source extends ActorWebSourceHandle<
									infer _SourceHandleContext,
									infer _SourceHandleMessage,
									infer _SourceHandleEmitted
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
