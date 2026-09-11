import type {
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebExtendedState,
	ActorWebSource,
} from "@ignite-element/adapters/actor-web";
import { createActorWebAdapter } from "@ignite-element/adapters/actor-web";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type {
	ActorWebConfig,
	IgniteCoreReturn,
	WithEmittedEvents,
} from "./actorWebTypes";
import {
	createIgniteComponentFactory,
	type IgniteComponentFactoryOptions,
} from "./createIgniteComponentFactory";

type ActorWebSubpathSourceValue<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebCommandSource<Context, Message, Emitted>;

type ActorWebSubpathConfig<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Omit<
	ActorWebConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>,
	"adapter" | "source" | "states"
> & {
	adapter?: "actor-web";
	source:
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>);
	states?: ActorWebConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>["states"];
};

export function igniteCoreActorWeb<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: ActorWebSubpathConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>,
): IgniteCoreReturn<
	ActorWebExtendedState<Context>,
	Message,
	ActorWebExtendedState<Context>,
	StatesResult,
	ActorWebCommandActor<Context, Message, Emitted>,
	CommandsResult,
	WithEmittedEvents<Events, Emitted, Message>
> {
	// Actor-Web remains the runtime owner; Ignite only adapts projection snapshots
	// and command access into the headless component contract.
	const createAdapter = createActorWebAdapter(options.source, {
		ownsFactorySource: false,
	});
	const componentOptions = options as unknown as IgniteComponentFactoryOptions<
		ActorWebExtendedState<Context>,
		ActorWebCommandActor<Context, Message, Emitted>,
		StatesResult,
		CommandsResult,
		Events
	>;
	return createIgniteComponentFactory<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		StatesResult,
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		Events
	>(createAdapter, componentOptions) as unknown as IgniteCoreReturn<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		StatesResult,
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		WithEmittedEvents<Events, Emitted, Message>
	>;
}
