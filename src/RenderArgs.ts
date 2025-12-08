import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateCommandActor,
} from "./adapters/XStateAdapter";
import type { InferStateAndEvent } from "./utils/igniteRedux";

type AdapterState<Source> = Source extends AnyStateMachine
	? ExtendedState<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["State"]
		: Source extends () => EnhancedStore
			? InferStateAndEvent<Source>["State"]
			: Source extends EnhancedStore
				? InferStateAndEvent<Source>["State"]
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

type AdapterEvent<Source> = Source extends AnyStateMachine
	? EventFrom<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["Event"]
		: Source extends () => EnhancedStore
			? InferStateAndEvent<Source>["Event"]
			: Source extends EnhancedStore
				? InferStateAndEvent<Source>["Event"]
				: Source extends () => object
					? MobxEvent<ReturnType<Source>>
					: Source extends object
						? MobxEvent<Source>
						: never;

export type ReduxSliceCommandActor<SliceType extends Slice> = {
	dispatch: (event: InferStateAndEvent<SliceType>["Event"]) => void;
	getState: () => InferStateAndEvent<SliceType>["State"];
	subscribe: (listener: () => void) => () => void;
};

export type ReduxStoreCommandActor<StoreInstance extends EnhancedStore> = {
	dispatch: (event: InferStateAndEvent<StoreInstance>["Event"]) => void;
	getState: () => InferStateAndEvent<StoreInstance>["State"];
	subscribe: StoreInstance["subscribe"];
};

type AdapterSnapshot<Source> = Source extends AnyStateMachine
	? StateFrom<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["State"]
		: Source extends () => EnhancedStore
			? InferStateAndEvent<Source>["State"]
			: Source extends EnhancedStore
				? InferStateAndEvent<Source>["State"]
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

type AdapterActor<Source> = Source extends AnyStateMachine
	? XStateCommandActor<Source>
	: Source extends Slice
		? ReduxSliceCommandActor<Source>
		: Source extends () => EnhancedStore
			? ReduxStoreCommandActor<ReturnType<Source>>
			: Source extends EnhancedStore
				? ReduxStoreCommandActor<Source>
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

export type FacadeStatesCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (snapshot: Snapshot) => Result;

export type FacadeCommandFunction = (...args: never[]) => unknown;

export type FacadeCommandResult = Record<string, FacadeCommandFunction>;

export type EmptyEventMap = Record<never, EventDescriptor<never>>;

export type EventDescriptor<Payload> = {
	readonly __payload?: Payload;
};

export type EventMap = Record<string, EventDescriptor<unknown>>;

export type EventBuilder = <Payload>() => EventDescriptor<Payload>;

type EventPayload<Descriptor> = Descriptor extends EventDescriptor<
	infer Payload
>
	? Payload
	: never;

export type EmitFromEvents<Events extends EventMap> = keyof Events extends never
	? (type: never, payload: never) => void
	: <Type extends keyof Events & string>(
			type: Type,
			...args: undefined extends EventPayload<Events[Type]>
				? [payload?: EventPayload<Events[Type]>]
				: [payload: EventPayload<Events[Type]>]
		) => void;

export type CommandContext<Actor, Events extends EventMap = EmptyEventMap> = {
	actor: Actor;
	emit: EmitFromEvents<Events>;
	host: HTMLElement;
};

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
> = (context: CommandContext<Actor, Events>) => Result;

type IsNever<T> = [T] extends [never] ? true : false;

type StateResult<
	Source,
	StateCallback,
	Result = [StateCallback] extends [
		FacadeStatesCallback<AdapterSnapshot<Source>, infer Result>,
	]
		? Result
		: Record<never, never>,
> = IsNever<StateCallback> extends true ? Record<never, never> : Result;

type CommandResult<
	Source,
	CommandCallback,
	Result = CommandCallback extends FacadeCommandsCallback<
		AdapterActor<Source>,
		infer CallbackResult,
		infer _Events
	>
		? CallbackResult extends FacadeCommandResult
			? CallbackResult
			: Record<never, never>
		: Record<never, never>,
> = IsNever<CommandCallback> extends true ? Record<never, never> : Result;

type BaseRenderArgs<Source> = {
	state: AdapterState<Source>;
	send: (event: AdapterEvent<Source>) => void;
};

export type RenderArgs<
	Source,
	StateCallback = undefined,
	CommandCallback = undefined,
> = BaseRenderArgs<Source> &
	StateResult<Source, NonNullable<StateCallback>> &
	CommandResult<Source, NonNullable<CommandCallback>>;
