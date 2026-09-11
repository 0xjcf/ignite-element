import type {
	InferStateAndEvent,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "@ignite-element/adapters";
import type { XStateCommandActor } from "@ignite-element/adapters/xstate";
import type {
	CommandContext as CoreCommandContext,
	EffectContext as CoreEffectContext,
	EffectSelection as CoreEffectSelection,
	EffectSelector as CoreEffectSelector,
	FacadeEffectArgs as CoreFacadeEffectArgs,
	EmitFromEvents,
	EmptyEventMap,
	EventBuilder,
	EventDescriptor,
	EventMap,
	EventMember,
	EventMemberFields,
	EventPayload,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
} from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, StateFrom } from "xstate";

export type {
	EmptyEventMap,
	FacadeEffectsObjectCallback,
	EmitFromEvents,
	EventBuilder,
	EventDescriptor,
	EventMap,
	EventMember,
	EventMemberFields,
	EventPayload,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeStatesCallback,
};
export type {
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "@ignite-element/adapters";

export type CommandContext<
	Actor,
	Host = unknown,
	Snapshot = unknown,
> = CoreCommandContext<Actor, Host, Snapshot>;

export type EffectContext<
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
	Snapshot = unknown,
> = CoreEffectContext<Actor, Events, Host, Snapshot>;

export type EffectSelection<Value> = CoreEffectSelection<Value>;
export type EffectSelector<Snapshot> = CoreEffectSelector<Snapshot>;
export type FacadeEffectArgs<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = CoreFacadeEffectArgs<Snapshot, Actor, Events, Host>;
export type { IgniteSchemaValue } from "./types/schema";

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
	Host = unknown,
	Snapshot = unknown,
> = (context: CommandContext<Actor, Host, Snapshot>) => Result;

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
		infer _Host,
		infer _Snapshot
	>
		? CallbackResult extends FacadeCommandResult
			? CallbackResult
			: Record<never, never>
		: Record<never, never>,
> = IsNever<CommandCallback> extends true ? Record<never, never> : Result;

export type RenderArgs<
	Source,
	StateCallback = undefined,
	CommandCallback = undefined,
> = StateResult<Source, NonNullable<StateCallback>> &
	CommandResult<Source, NonNullable<CommandCallback>>;
