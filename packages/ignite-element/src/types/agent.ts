import type {
	EmptyEventMap,
	EventMap,
	EventMember,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { IgniteAgentSchema, IgniteSchemaValue } from "./schema";

type RuntimeEventUnion<Events extends EventMap> = {
	[Type in keyof Events & string]: EventMember<Events, Type>;
}[keyof Events & string];

export type RuntimeEvent<Events extends EventMap = EmptyEventMap> = [
	keyof Events & string,
] extends [never]
	? {
			type: string;
			[key: string]: unknown;
		}
	: RuntimeEventUnion<Events>;

type CommandPayload<
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string,
> = Parameters<Commands[CommandName]> extends []
	? undefined
	: Parameters<Commands[CommandName]>[0];

export type IgniteCommandCall<
	Commands extends FacadeCommandResult = FacadeCommandResult,
	CommandName extends keyof Commands & string = keyof Commands & string,
> = {
	[Name in CommandName]: Parameters<Commands[Name]> extends [
		unknown,
		unknown,
		...unknown[],
	]
		? never
		: Parameters<Commands[Name]> extends []
			? { command: Name }
			: undefined extends CommandPayload<Commands, Name>
				? { command: Name; input?: CommandPayload<Commands, Name> }
				: { command: Name; input: CommandPayload<Commands, Name> };
}[CommandName];

export type IgniteAgentEventListener<
	Events extends EventMap = EmptyEventMap,
	Type extends keyof Events & string = keyof Events & string,
> = (event: EventMember<Events, Type>) => void;

export type IgniteAgentSnapshotListener<Snapshot> = (
	snapshot: Snapshot,
	prevSnapshot: Snapshot | undefined,
) => void;

/** Options for `watch`. `emitCurrent` defaults to true. */
export type IgniteWatchOptions = {
	/**
	 * Deliver the current derived states when the handler is subscribed.
	 * That first call uses `previous === undefined`.
	 * Set false to observe later transitions only.
	 */
	emitCurrent?: boolean;
};

export type IgniteAgentSubscription = {
	unsubscribe: () => void;
};

export type IgniteAgentRuntime<
	_State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
	States extends Record<string, unknown> = Record<never, never>,
> = {
	execute<CommandName extends keyof Commands & string>(
		call: IgniteCommandCall<Commands, CommandName>,
	): Promise<Awaited<ReturnType<Commands[CommandName]>>>;
	get(key: "states"): States;
	get(key: "schema"): IgniteAgentSchema<SchemaState, States>;
	get(key: "commands"): IgniteAgentSchema["commands"];
	get(key: "events"): IgniteAgentSchema["events"];
	dispose(): void;
	on<Type extends keyof Events & string>(
		eventName: Type,
		handler: IgniteAgentEventListener<Events, Type>,
	): IgniteAgentSubscription;
	watch(
		handler: IgniteAgentSnapshotListener<States>,
		options?: IgniteWatchOptions,
	): IgniteAgentSubscription;
};
