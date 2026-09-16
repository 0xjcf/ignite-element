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
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";
import type { IgniteCoreReturn } from "./actorWebTypes";
import {
	createIgniteComponentFactory,
	type IgniteComponentFactoryOptions,
} from "./createIgniteComponentFactory";
import type {
	ChannelEmitted,
	CompatibleEvents,
	EffectEvents,
} from "./eventProducerTypes";
import type { ActorWebRuntimeEvents } from "./publicTypes";

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
	Source extends
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>) =
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>),
> = {
	commands?: FacadeCommandsCallback<
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		unknown,
		ActorWebExtendedState<Context>
	>;
	cleanup?: boolean;
	events?: EventsDefinition<
		Events & CompatibleEvents<NoInfer<Events>, ChannelEmitted<NoInfer<Source>>>
	>;
	effects?: FacadeEffectsObjectCallback<
		ActorWebExtendedState<Context>,
		ActorWebCommandActor<Context, Message, Emitted>,
		NoInfer<EffectEvents<Events, ChannelEmitted<Source>>>
	>;
	adapter?: "actor-web";
	source: Source &
		(
			| ActorWebSubpathSourceValue<Context, Message, Emitted>
			| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>)
		);
	states?: FacadeStatesCallback<ActorWebExtendedState<Context>, StatesResult>;
} & import("./publicTypes").DisjointBindings<
	NoInfer<StatesResult>,
	NoInfer<CommandsResult>
>;

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
	Source extends
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>) =
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>),
>(
	options: ActorWebSubpathConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult,
		Source
	>,
): IgniteCoreReturn<
	ActorWebExtendedState<Context>,
	Message,
	ActorWebExtendedState<Context>,
	StatesResult,
	ActorWebCommandActor<Context, Message, Emitted>,
	CommandsResult,
	ActorWebRuntimeEvents<Events, Source, Emitted, Message>,
	Events
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
		ActorWebRuntimeEvents<Events, Source, Emitted, Message>,
		Events
	>;
}
