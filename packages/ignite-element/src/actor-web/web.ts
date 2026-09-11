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
import type {
	IgniteCoreReturn,
	WithEmittedEvents,
} from "../igniteCore/actorWebTypes";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import type { DisjointBindings } from "../igniteCore/publicTypes";

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
>(
	options: {
		adapter?: "actor-web";
		source: ActorWebHostFactory<Context, Message, Emitted>;
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
		events?: EventsDefinition<Events>;
		cleanup?: boolean;
		effects?: FacadeEffectsObjectCallback<
			ActorWebExtendedState<NoInfer<Context>>,
			ActorWebCommandActor<
				NoInfer<Context>,
				NoInfer<Message>,
				NoInfer<Emitted>
			>,
			Events
		>;
	} & DisjointBindings<NoInfer<States>, NoInfer<Commands>>,
): IgniteCoreReturn<
	ActorWebExtendedState<Context>,
	Message,
	ActorWebExtendedState<Context>,
	States,
	ActorWebCommandActor<Context, Message, Emitted>,
	Commands,
	WithEmittedEvents<Events, Emitted, Message>
> {
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
		options,
	) as IgniteCoreReturn<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		States,
		ActorWebCommandActor<Context, Message, Emitted>,
		Commands,
		WithEmittedEvents<Events, Emitted, Message>
	>;
}
