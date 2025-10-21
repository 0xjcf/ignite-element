import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import type { MobxEvent } from "./adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateActorInstance,
} from "./adapters/XStateAdapter";
import type {
	InferEvent,
	InferStateAndEvent,
	ReduxActions,
} from "./utils/igniteRedux";

type AdapterState<
	Source,
	Actions extends ReduxActions | undefined,
> = Source extends AnyStateMachine
	? ExtendedState<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["State"]
		: Source extends () => EnhancedStore
			? InferStateAndEvent<Source, Actions>["State"]
			: Source extends EnhancedStore
				? InferStateAndEvent<Source, Actions>["State"]
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

type AdapterEvent<
	Source,
	Actions extends ReduxActions | undefined,
> = Source extends AnyStateMachine
	? EventFrom<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["Event"]
		: Source extends () => EnhancedStore
			? Actions extends ReduxActions
				? InferEvent<Actions>
				: { type: string }
			: Source extends EnhancedStore
				? InferStateAndEvent<Source, Actions>["Event"]
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
	Actions extends ReduxActions | undefined,
> = {
	dispatch: (
		event: InferStateAndEvent<StoreInstance, Actions>["Event"],
	) => ReturnType<StoreInstance["dispatch"]>;
	getState: () => InferStateAndEvent<StoreInstance, Actions>["State"];
	subscribe: StoreInstance["subscribe"];
};

type AdapterSnapshot<
	Source,
	Actions extends ReduxActions | undefined,
> = Source extends AnyStateMachine
	? StateFrom<Source>
	: Source extends Slice
		? InferStateAndEvent<Source>["State"]
		: Source extends () => EnhancedStore
			? InferStateAndEvent<Source, Actions>["State"]
			: Source extends EnhancedStore
				? InferStateAndEvent<Source, Actions>["State"]
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

type AdapterActor<
	Source,
	Actions extends ReduxActions | undefined,
> = Source extends AnyStateMachine
	? XStateActorInstance<Source>
	: Source extends Slice
		? ReduxSliceCommandActor<Source>
		: Source extends () => EnhancedStore
			? ReduxStoreCommandActor<ReturnType<Source>, Actions>
			: Source extends EnhancedStore
				? ReduxStoreCommandActor<Source, Actions>
				: Source extends () => object
					? ReturnType<Source>
					: Source extends object
						? Source
						: never;

export type FacadeStatesCallback<
	Snapshot,
	Result extends Record<string, unknown> = Record<string, unknown>,
> = (snapshot: Snapshot) => Result;

export type FacadeCommandsCallback<
	Actor,
	Result extends Record<string, (...args: unknown[]) => unknown> = Record<
		string,
		(...args: unknown[]) => unknown
	>,
> = (actor: Actor) => Result;

type StateResult<
	Source,
	Actions extends ReduxActions | undefined,
	StateCallback,
> = [StateCallback] extends [
	FacadeStatesCallback<AdapterSnapshot<Source, Actions>, infer Result>,
]
	? Result
	: Record<never, never>;

type CommandResult<
	Source,
	Actions extends ReduxActions | undefined,
	CommandCallback,
> = [CommandCallback] extends [
	FacadeCommandsCallback<AdapterActor<Source, Actions>, infer Result>,
]
	? Result
	: Record<never, never>;

type BaseRenderArgs<Source, Actions extends ReduxActions | undefined> = {
	state: AdapterState<Source, Actions>;
	send: (event: AdapterEvent<Source, Actions>) => void;
};

export type RenderArgs<
	Source,
	Actions extends ReduxActions | undefined = undefined,
	StateCallback = undefined,
	CommandCallback = undefined,
> = BaseRenderArgs<Source, Actions> &
	StateResult<Source, Actions, NonNullable<StateCallback>> &
	CommandResult<Source, Actions, NonNullable<CommandCallback>>;
