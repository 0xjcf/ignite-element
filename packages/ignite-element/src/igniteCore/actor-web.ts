import type {
	ActorWebCommandActor,
	ActorWebExtendedState,
} from "ignite-adapters/actor-web";
import { createActorWebAdapter } from "ignite-adapters/actor-web";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type { ActorWebConfig, IgniteCoreReturn } from "./types";

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
	options: ActorWebConfig<
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
	const createAdapter = createActorWebAdapter(options.source);
	return createIgniteComponentFactory<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		StatesResult,
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		Events
	>(createAdapter, options) as IgniteCoreReturn<
		ActorWebExtendedState<Context>,
		Message,
		ActorWebExtendedState<Context>,
		StatesResult,
		ActorWebCommandActor<Context, Message, Emitted>,
		CommandsResult,
		Events
	>;
}
