import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateActorInstance,
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

export type ReduxStoreCommandActor<
	StoreInstance extends EnhancedStore,
> = {
	dispatch: (
		event: InferStateAndEvent<StoreInstance>["Event"],
	) => ReturnType<StoreInstance["dispatch"]>;
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
	? XStateActorInstance<Source>
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

export type FacadeCommandsCallback<
	Actor,
	Result extends FacadeCommandResult = FacadeCommandResult,
> = (actor: Actor) => Result;

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
	Result = [CommandCallback] extends [
		FacadeCommandsCallback<AdapterActor<Source>, infer Result>,
	]
		? Result
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
