import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type {
	CommandContext as CoreCommandContext,
	EffectContext as CoreEffectContext,
	EffectSelection as CoreEffectSelection,
	EffectSelector as CoreEffectSelector,
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventBuilder,
	EventDescriptor,
	EventMap,
	EventPayload,
	ExtendedState,
	FacadeEffectArgs as CoreFacadeEffectArgs,
	FacadeEffectsCallback,
	FacadeEffectsLike,
	FacadeEffectsObjectCallback,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeStatesCallback,
	FacadeViewCallback,
	ViewContext as CoreViewContext,
	XStateCommandActor,
} from "ignite-core";
import type {
	InferStateAndEvent,
	MobxEvent,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "ignite-store";
import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";

export type {
	EmptyEventMap,
	FacadeEffectsLike,
	FacadeEffectsCallback,
	FacadeEffectsObjectCallback,
	EmitFromEvents,
	EmitPayloadArgs,
	EventBuilder,
	EventDescriptor,
	EventMap,
	EventPayload,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeStatesCallback,
	FacadeViewCallback,
};
export type {
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "ignite-store";

export type CommandContext<Actor, Host = HTMLElement> = CoreCommandContext<
	Actor,
	Host
>;

export type EffectContext<
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = HTMLElement,
	Snapshot = unknown,
> = CoreEffectContext<Actor, Events, Host, Snapshot>;

export type EffectSelection<Value> = CoreEffectSelection<Value>;
export type EffectSelector<Snapshot> = CoreEffectSelector<Snapshot>;
export type FacadeEffectArgs<
	Snapshot,
	Actor,
	Events extends EventMap = EmptyEventMap,
	Host = HTMLElement,
> = CoreFacadeEffectArgs<Snapshot, Actor, Events, Host>;
export type ViewContext<Snapshot> = CoreViewContext<Snapshot>;

export type { IgniteSchemaValue } from "./types/schema";

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
	Host = HTMLElement,
> = (context: CommandContext<Actor, Host>) => Result;

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
		: [StateCallback] extends [
					FacadeViewCallback<AdapterSnapshot<Source>, infer Result>,
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
