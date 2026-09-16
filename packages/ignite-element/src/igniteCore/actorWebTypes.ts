import type {
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebExtendedState,
	ActorWebSource,
} from "@ignite-element/adapters/actor-web";
import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";

export type { IgniteCoreReturn, WithEmittedEvents } from "./publicTypes";

import type { DisjointBindings } from "./publicTypes";

type ActorWebSourceValue<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebCommandSource<Context, Message, Emitted>;

export type ActorWebSourceLike<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSourceValue<Context, Message, Emitted>
	| (() => ActorWebSourceValue<Context, Message, Emitted>);

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
	commands?: FacadeCommandsCallback<
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		unknown,
		ActorWebExtendedState<Context>
	>;
	events?: EventsDefinition<Events>;
	/**
	 * Controls element-lifecycle teardown of the *shared* adapter. Defaults to
	 * `true` for isolated cores (ignite owns one adapter per element) and `false`
	 * for shared cores (you pass an already-live, consumer-owned source that
	 * lives for the core's lifetime). Set `true` to opt a shared core back into
	 * element-refcount teardown; ignite never stops or closes a source it did
	 * not create. An activated shared effect evaluator retains observation until
	 * core disposal, regardless of this option.
	 */
	cleanup?: boolean;
	effects?: FacadeEffectsObjectCallback<
		ActorWebExtendedState<Context>,
		ActorWebCommandActor<Context, Message, Emitted>,
		Events
	>;
} & ActorWebConfigSource<Context, Message, Emitted, Source> &
	DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;

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
