import type {
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebExtendedState,
	ActorWebSource,
	ActorWebSourceHandle,
} from "@ignite-element/adapters/actor-web";
import { createActorWebAdapter } from "@ignite-element/adapters/actor-web";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import {
	createIgniteComponentFactory,
	type IgniteComponentFactoryOptions,
} from "./createIgniteComponentFactory";
import type { ActorWebConfig, IgniteCoreReturn } from "./types";

type ActorWebSubpathSourceValue<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebCommandSource<Context, Message, Emitted>
	| ActorWebSourceHandle<Context, Message, Emitted>;

type ActorWebSubpathCommandSourceValue<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = ActorWebCommandSource<Context, Message, Emitted>;

type ActorWebSubpathHostContextFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = {
	bivarianceHack(context?: {
		host?: HTMLElement;
	}): ActorWebSubpathSourceValue<Context, Message, Emitted>;
}["bivarianceHack"];

type ActorWebSubpathCommandHostContextFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = {
	bivarianceHack(context?: {
		host?: HTMLElement;
	}): ActorWebSubpathCommandSourceValue<Context, Message, Emitted>;
}["bivarianceHack"];

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
	"adapter" | "source" | "view" | "states" | "commandSource"
> & {
	adapter?: "actor-web";
	source:
		| ActorWebSubpathSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathSourceValue<Context, Message, Emitted>)
		| ActorWebSubpathHostContextFactory<Context, Message, Emitted>;
	view?: ActorWebConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>["view"];
	/** @deprecated Use `view` instead. Removed at stable v3. */
	states?: ActorWebConfig<
		Context,
		Message,
		Emitted,
		Events,
		StatesResult,
		CommandsResult
	>["states"];
	commandSource?:
		| ActorWebSubpathCommandSourceValue<Context, Message, Emitted>
		| (() => ActorWebSubpathCommandSourceValue<Context, Message, Emitted>)
		| ActorWebSubpathCommandHostContextFactory<Context, Message, Emitted>;
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
	Events
> {
	// Actor-Web remains the runtime owner; Ignite only adapts projection snapshots
	// and command access into the headless component contract.
	const createAdapter = createActorWebAdapter(options.source, {
		commandSource: options.commandSource,
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
	>(createAdapter, componentOptions) as IgniteCoreReturn<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		StatesResult,
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		Events
	>;
}
