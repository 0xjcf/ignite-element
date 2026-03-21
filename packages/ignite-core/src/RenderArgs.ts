export type FacadeStatesCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (snapshot: Snapshot) => Result;

export type FacadeCommandFunction = (...args: never[]) => unknown;

export type FacadeCommandResult = Record<string, FacadeCommandFunction>;

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
> = {
	actor: Actor;
	emit: EmitFromEvents<Events>;
	host: Host;
};

export type FacadeEffectsCallback<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = (
	snapshot: Snapshot,
	prevSnapshot: Snapshot,
	context: EffectContext<Actor, Events, Host>,
) => void;

type IsNever<T> = [T] extends [never] ? true : false;

type StateResult<
	Snapshot,
	StateCallback,
	Result = [StateCallback] extends [
		FacadeStatesCallback<Snapshot, infer Result>,
	]
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
