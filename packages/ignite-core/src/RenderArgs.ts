export type FacadeStatesCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (snapshot: Snapshot) => Result;

export type ViewContext<Snapshot> = {
	snapshot: Snapshot;
};

export type FacadeViewCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (context: ViewContext<Snapshot>) => Result;

// biome-ignore lint/suspicious/noExplicitAny: tuple-preserving command metadata needs an unconstrained callable base type.
export type FacadeCommandFunction = (...args: any[]) => unknown;

export type FacadeCommandResult = Record<string, FacadeCommandFunction>;

export const commandMetadataSymbol: unique symbol = Symbol.for(
	"ignite.command.metadata",
) as never;

export type CommandMetadataPrimitive = null | boolean | number | string;

export type CommandMetadataValue =
	| CommandMetadataPrimitive
	| CommandMetadataValue[]
	| { [key: string]: CommandMetadataValue | undefined };

export type NumberCommandInputMetadata = {
	type: "number";
	description?: string;
	minimum?: number;
	maximum?: number;
	multipleOf?: number;
	default?: number;
};

export type NumberCommandInputOptions = Omit<
	NumberCommandInputMetadata,
	"type"
>;

export type CommandMetadata = {
	description?: string;
	input?: CommandMetadataValue;
	[key: string]: CommandMetadataValue | undefined;
};

export type CommandWithMetadata<
	Command extends FacadeCommandFunction = FacadeCommandFunction,
> = Command & {
	readonly [commandMetadataSymbol]?: CommandMetadata;
};

export type CommandHelper = {
	<Command extends FacadeCommandFunction>(
		commandFunction: Command,
		metadata?: CommandMetadata,
	): CommandWithMetadata<Command>;
	number(options?: NumberCommandInputOptions): NumberCommandInputMetadata;
};

const attachCommandMetadata = <Command extends FacadeCommandFunction>(
	commandFunction: Command,
	metadata?: CommandMetadata,
): CommandWithMetadata<Command> => {
	if (metadata === undefined) {
		return commandFunction as CommandWithMetadata<Command>;
	}

	const wrappedCommand = function (this: unknown, ...args: unknown[]) {
		return (
			commandFunction as unknown as (
				this: unknown,
				...args: unknown[]
			) => unknown
		).apply(this, args);
	} as unknown as CommandWithMetadata<Command>;

	Object.defineProperty(wrappedCommand, commandMetadataSymbol, {
		configurable: true,
		enumerable: false,
		value: metadata,
		writable: false,
	});

	return wrappedCommand;
};

export const command: CommandHelper = Object.assign(attachCommandMetadata, {
	number(options: NumberCommandInputOptions = {}) {
		return {
			type: "number" as const,
			...options,
		};
	},
});

export type EmptyEventMap = {
	readonly [Type in never]: EventDescriptor<never>;
};

export type EventDescriptor<Payload> = {
	readonly __payload?: Payload;
};

export type EventMap = {
	readonly [Type in string]: EventDescriptor<unknown>;
};

export type EventBuilder = <Payload>() => EventDescriptor<Payload>;

export type EventPayload<Descriptor> = Descriptor extends EventDescriptor<
	infer Payload
>
	? Payload
	: never;

export type EmitPayloadArgs<
	Events extends EventMap,
	Type extends keyof Events & string,
> = undefined extends EventPayload<Events[Type]>
	? [payload?: EventPayload<Events[Type]> | undefined]
	: [payload: EventPayload<Events[Type]>];

export type EmitFromEvents<Events extends EventMap> = <
	Type extends keyof Events & string,
>(
	type: Type,
	...args: EmitPayloadArgs<Events, Type>
) => void;

export type CommandContext<Actor, Host = unknown> = {
	actor: Actor;
	command: CommandHelper;
	host: Host;
};

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
	Host = unknown,
> = (context: CommandContext<Actor, Host>) => Result;

export type EffectContext<
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
	Snapshot = unknown,
> = {
	actor: Actor;
	emit: EmitFromEvents<Events>;
	host: Host;
	select: EffectSelector<Snapshot>;
};

export type EffectSelection<Value> = {
	current: Value;
	previous: Value;
	changed: boolean;
};

export type EffectSelector<Snapshot> = <Value>(
	selector: (snapshot: Snapshot) => Value,
) => EffectSelection<Value>;

export type FacadeEffectArgs<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = EffectContext<Actor, Events, Host, Snapshot> & {
	snapshot: Snapshot;
	prevSnapshot: Snapshot;
};

export type FacadeEffectsCallback<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = (
	snapshot: Snapshot,
	prevSnapshot: Snapshot,
	context: EffectContext<Actor, Events, Host, Snapshot>,
) => void;

export type FacadeEffectsObjectCallback<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = (args: FacadeEffectArgs<Snapshot, Actor, Events, Host>) => void;

export type FacadeEffectsLike<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> =
	| FacadeEffectsCallback<Snapshot, Actor, Events, Host>
	| FacadeEffectsObjectCallback<Snapshot, Actor, Events, Host>;

type IsNever<T> = [T] extends [never] ? true : false;

type StateResult<
	Snapshot,
	StateCallback,
	Result = [StateCallback] extends [
		FacadeStatesCallback<Snapshot, infer Result>,
	]
		? Result
		: [StateCallback] extends [FacadeViewCallback<Snapshot, infer Result>]
			? Result
			: Record<never, never>,
> = IsNever<StateCallback> extends true ? Record<never, never> : Result;

type CommandResult<
	CommandCallback,
	Result = CommandCallback extends FacadeCommandsCallback<
		infer _Actor,
		infer CallbackResult,
		infer _Host
	>
		? CallbackResult extends FacadeCommandResult
			? CallbackResult
			: Record<never, never>
		: Record<never, never>,
> = IsNever<CommandCallback> extends true ? Record<never, never> : Result;

export type BaseRenderArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

export type RenderArgs<
	State,
	Event,
	Snapshot = State,
	StateCallback = undefined,
	CommandCallback = undefined,
> = BaseRenderArgs<State, Event> &
	StateResult<Snapshot, NonNullable<StateCallback>> &
	CommandResult<NonNullable<CommandCallback>>;
