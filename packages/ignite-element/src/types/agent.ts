import type {
	EmptyEventMap,
	EventMap,
	EventPayload,
	FacadeCommandResult,
} from "../RenderArgs";
import type { IgniteAgentSchema, IgniteSchemaValue } from "./schema";

type RuntimeEventUnion<Events extends EventMap> = {
	[Type in keyof Events & string]: {
		type: Type;
		payload: EventPayload<Events[Type]>;
	};
}[keyof Events & string];

export type RuntimeEvent<Events extends EventMap = EmptyEventMap> = [
	keyof Events & string,
] extends [never]
	? {
			type: string;
			payload: unknown;
		}
	: RuntimeEventUnion<Events>;

type CommandPayload<
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string,
> = Parameters<Commands[CommandName]> extends []
	? undefined
	: Parameters<Commands[CommandName]>[0];

export type IgniteAgentExecutionResult<
	State,
	Events extends EventMap = EmptyEventMap,
> = {
	state: State;
	events: RuntimeEvent<Events>[];
};

export type IgniteAgentRuntime<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
> = {
	execute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
		payload?: CommandPayload<Commands, CommandName>,
	): IgniteAgentExecutionResult<State, Events>;
	getState(): State;
	subscribe<Type extends keyof Events & string>(
		eventName: Type,
		handler: (event: CustomEvent<EventPayload<Events[Type]>>) => void,
	): {
		unsubscribe: () => void;
	};
	getSchema(): IgniteAgentSchema<SchemaState>;
};
