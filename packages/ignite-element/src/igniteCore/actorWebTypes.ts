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
	/** Activated shared effects retain observation until terminal core disposal.
	 * Observation does not grant ownership of the source's native close operation.
	 */
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
