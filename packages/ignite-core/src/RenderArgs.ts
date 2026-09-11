export type FacadeStatesCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (snapshot: Snapshot) => Result;

// biome-ignore lint/suspicious/noExplicitAny: tuple-preserving command metadata needs an unconstrained callable base type.
export type FacadeCommandFunction = (...args: any[]) => unknown;

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

// biome-ignore lint/suspicious/noConfusingVoidType: `event<void>()` is a supported no-payload authoring form.
type EventPayloadFields<Payload> = void extends Payload
	? Exclude<Payload, void>
	: undefined extends Payload
		? Exclude<Payload, undefined>
		: Payload;

export type EventMemberFields<Descriptor> = EventPayloadFields<
	EventPayload<Descriptor>
>;

type SimplifyEventMember<T> = { [Key in keyof T]: T[Key] };

type EventMemberWithType<Type extends string, Fields> = SimplifyEventMember<
	Omit<Fields, "type"> & { type: Type }
>;

type EventMemberFromTypedPayload<Type extends string, Fields> = Extract<
	Fields,
	{ type: Type }
> extends never
	? Fields extends { type: infer PayloadType }
		? Type extends PayloadType & string
			? EventMemberWithType<Type, Fields>
			: never
		: never
	: SimplifyEventMember<Extract<Fields, { type: Type }>>;

type EventMemberFromPayload<Type extends string, Payload> = [
	EventPayloadFields<Payload>,
] extends [never]
	? { type: Type }
	: EventPayloadFields<Payload> extends infer Fields
		? Fields extends { type: string }
			? EventMemberFromTypedPayload<Type, Fields>
			: SimplifyEventMember<{ type: Type } & Fields>
		: never;

export type EventMember<
	Events extends EventMap,
	Type extends keyof Events & string = keyof Events & string,
> = Type extends keyof Events & string
	? string extends keyof Events & string
		? SimplifyEventMember<{ type: Type } & Record<string, unknown>>
		: EventMemberFromPayload<Type, EventPayload<Events[Type]>>
	: never;

export type EmitFromEvents<Events extends EventMap> = <
	Type extends keyof Events & string,
>(
	event: EventMember<Events, Type>,
) => void;

type Phantom<T> = Record<never, T>;

export type CommandContext<Actor, Host = unknown, Snapshot = unknown> = {
	actor: Actor;
} & Phantom<Host> &
	Phantom<Snapshot>;

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
	Host = unknown,
	Snapshot = unknown,
> = (context: CommandContext<Actor, Host, Snapshot>) => Result;

export type EffectContext<
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
	Snapshot = unknown,
> = {
	emit: EmitFromEvents<Events>;
	select: EffectSelector<Snapshot>;
} & Phantom<Actor> &
	Phantom<Host>;

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

export type FacadeEffectsObjectCallback<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = (args: FacadeEffectArgs<Snapshot, Actor, Events, Host>) => undefined;

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
		infer _Host,
		infer _Snapshot
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
