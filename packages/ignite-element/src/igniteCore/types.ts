import type {
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebExtendedState,
	ActorWebReadModelSource,
	ActorWebSource,
	MobxEvent,
	ReduxBlueprintSource,
	ReduxCommandActorFor,
	ReduxInstanceSource,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
	MobxConfig as StoreMobxConfig,
	ReduxBlueprintConfig as StoreReduxBlueprintConfig,
	ReduxInstanceConfig as StoreReduxInstanceConfig,
} from "@ignite-element/adapters";
import type {
	XStateConfig as AdapterXStateConfig,
	XStateActorInstance,
} from "@ignite-element/adapters/xstate";
import type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyViewCallback,
	EmptyEventMap,
	EventDescriptor,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeViewCallback,
} from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";
import type { WithFacadeRenderArgs } from "../createProjectionFactory";
import type { ComponentFactory } from "../IgniteElementFactory";
import type {
	IgniteAgentRuntime,
	IgniteProjectionSession,
	IgniteProjectionTarget,
} from "../types/agent";
import type { IgniteAgentSchema, IgniteSchemaValue } from "../types/schema";

/**
 * Derives the runtime `Events` map for a source that emits domain
 * events. When the source declares a distinct `Emitted` union (≠ its command
 * `Message`), each emitted member is folded into the headless runtime's events
 * as the flat runtime event member, matching the runtime bridge, so
 * `on(...)` / `execute().events` are typed from the source with no `events:`
 * map. Explicitly declared `events:` keys win on collision. A non-distinct
 * `Emitted` (the `= Message` default) contributes nothing, and neither does a
 * broad union whose `type` is plain `string` (e.g. XState's `EventObject`
 * default on machines that declare no `emitted` types) — folding that in
 * would add a string index signature to the events map.
 */
export type WithEmittedEvents<
	Events extends EventMap,
	Emitted extends { type: string },
	Message extends { type: string },
> = [Emitted] extends [Message]
	? Events
	: string extends Emitted["type"]
		? Events
		: Events &
				Omit<
					{
						[Type in Emitted["type"]]: EventDescriptor<
							Extract<Emitted, { type: Type }>
						>;
					},
					keyof Events
				>;

/**
 * Typed per-element handle returned by registration (`igniteCore(config)(tag,
 * render)`). Additive: callers that ignore the return are unaffected. Carries
 * the registered `tagName` and a `getSchema()` that delegates to the same single
 * agent-runtime source of truth as the registrar. The `Commands`/`Events`
 * generics are PHANTOM (never populated at runtime) — they exist only to carry
 * the compile-time types that `igniteReact` (and future framework wrappers)
 * infer from a handle value. Runtime wiring reads `getSchema()`; the
 * compile-time mapping reads the phantom generics. Two surfaces, one source each.
 */
export interface IgniteComponent<
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
> {
	readonly tagName: string;
	getSchema(): IgniteAgentSchema<SchemaState>;
	readonly __commands?: Commands;
	readonly __events?: Events;
}

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
> = {
	(target: IgniteProjectionTarget): IgniteProjectionSession;
	// Call signature mirrors ComponentFactory's parameter typing (same
	// elementName + projected RenderArgs renderer) but returns a typed
	// IgniteComponent handle instead of void. The handle return is additive — a
	// function returning an object is assignable to a void-expecting position —
	// so existing side-effect callers compile unchanged.
	(
		...args: Parameters<
			ComponentFactory<
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
			>
		>
	): IgniteComponent<CommandsResult, Events>;
	readonly __igniteRenderArgs?: WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		Events
	> &
		Record<never, Snapshot>;
} & IgniteAgentRuntime<
	Snapshot,
	CommandsResult,
	Events,
	IgniteSchemaValue,
	StatesResult
>;
export type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyViewCallback,
	ActorWebCommandActor,
	ActorWebExtendedState,
	ActorWebSource,
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
	| ActorWebCommandSource<Context, Message, Emitted>;

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
	view?: FacadeViewCallback<ActorWebExtendedState<Context>, StatesResult>;
	commands?: FacadeCommandsCallback<
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		HTMLElement,
		ActorWebExtendedState<Context>
	>;
	events?: EventsDefinition<Events>;
	/**
	 * Controls element-lifecycle teardown of the *shared* adapter. Defaults to
	 * `true` for isolated cores (ignite owns one adapter per element) and `false`
	 * for shared cores (you pass an already-live, consumer-owned source that
	 * lives for the core's lifetime). Set `true` to opt a shared core back into
	 * element-refcount teardown; ignite never stops or closes a source it did
	 * not create.
	 */
	cleanup?: boolean;
	effects?: FacadeEffectsObjectCallback<
		ActorWebExtendedState<Context>,
		ActorWebCommandActor<Context, Message, Emitted>,
		Events,
		HTMLElement
	>;
} & ActorWebConfigSource<Context, Message, Emitted, Source>;

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
							: Result extends ActorWebReadModelSource<
										infer _ResultReadModelContext,
										infer _ResultReadModelMessage,
										infer _ResultReadModelEmitted
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
