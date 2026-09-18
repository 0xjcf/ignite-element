import {
	type ActorWebCommandActor,
	type ActorWebCommandSource,
	type ActorWebExtendedState,
	type ActorWebSource,
	createActorWebAdapter,
} from "@ignite-element/adapters/actor-web";
import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";
import type { IgniteCoreReturn } from "../igniteCore/actorWebTypes";
import type { IgniteComponentFactoryOptions } from "../igniteCore/createIgniteComponentFactory";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import type {
	ChannelEmitted,
	CompatibleEvents,
	EffectEvents,
} from "../igniteCore/eventProducerTypes";
import type {
	ActorWebRuntimeEvents,
	DisjointBindings,
} from "../igniteCore/publicTypes";
import { assertSupportedSourceOptions } from "../internal/assertSupportedSourceOptions";

export type ActorWebHostFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = (context: {
	host?: HTMLElement;
}) =>
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebCommandSource<Context, Message, Emitted>;

export function igniteCore<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Events extends EventMap = EmptyEventMap,
	States extends Record<string, unknown> = Record<never, never>,
	Commands extends FacadeCommandResult = Record<never, never>,
	Source extends ActorWebHostFactory<
		Context,
		Message,
		Emitted
	> = ActorWebHostFactory<Context, Message, Emitted>,
>(
	options: {
		adapter?: "actor-web";
		source: Source & ActorWebHostFactory<Context, Message, Emitted>;
		states?: FacadeStatesCallback<
			ActorWebExtendedState<NoInfer<Context>>,
			States
		>;
		commands?: FacadeCommandsCallback<
			ActorWebCommandActor<
				NoInfer<Context>,
				NoInfer<Message>,
				NoInfer<Emitted>
			>,
			Commands,
			unknown,
			ActorWebExtendedState<NoInfer<Context>>
		>;
		events?: EventsDefinition<
			Events &
				CompatibleEvents<NoInfer<Events>, ChannelEmitted<NoInfer<Source>>>
		>;
		effects?: FacadeEffectsObjectCallback<
			ActorWebExtendedState<NoInfer<Context>>,
			ActorWebCommandActor<
				NoInfer<Context>,
				NoInfer<Message>,
				NoInfer<Emitted>
			>,
			EffectEvents<NoInfer<Events>, ChannelEmitted<NoInfer<Source>>>
		>;
	} & DisjointBindings<NoInfer<States>, NoInfer<Commands>>,
): IgniteCoreReturn<
	ActorWebExtendedState<Context>,
	Message,
	ActorWebExtendedState<Context>,
	States,
	ActorWebCommandActor<Context, Message, Emitted>,
	Commands,
	ActorWebRuntimeEvents<Events, Source, Emitted, Message>,
	Events
> {
	assertSupportedSourceOptions(options);
	const factory = createActorWebAdapter<Context, Message, Emitted, HTMLElement>(
		(context = {}) => options.source(context),
		{ ownsFactorySource: true },
	);
	const createAdapter = Object.assign((host?: HTMLElement) => {
		if (!host)
			throw new Error(
				"[igniteCore] Actor-Web web factories require an element; headless acquisition is not supported.",
			);
		return factory(host);
	}, factory);
	return createIgniteComponentFactory(
		createAdapter,
		options as IgniteComponentFactoryOptions<
			ActorWebExtendedState<Context>,
			ActorWebCommandActor<Context, Message, Emitted>,
			States,
			Commands,
			Events
		>,
	) as IgniteCoreReturn<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		States,
		ActorWebCommandActor<Context, Message, Emitted>,
		Commands,
		ActorWebRuntimeEvents<Events, Source, Emitted, Message>,
		Events
	>;
}
