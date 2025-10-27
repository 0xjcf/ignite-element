import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine, EventFrom } from "xstate";
import createMobXAdapter, { type MobxEvent } from "./adapters/MobxAdapter";
import createReduxAdapter from "./adapters/ReduxAdapter";
import createXStateAdapter, {
	type ExtendedState,
	type XStateActorInstance,
} from "./adapters/XStateAdapter";
import {
	createComponentFactory,
	type WithFacadeRenderArgs,
} from "./createComponentFactory";
import type { ComponentFactory } from "./IgniteElementFactory";
import type {
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "./RenderArgs";
import {
	isMobxObservable,
	isReduxSlice,
	isReduxStore,
	isXStateActor,
	isXStateMachine,
} from "./utils/adapterGuards";
import type { InferStateAndEvent } from "./utils/igniteRedux";

type AnyStatesCallback = FacadeStatesCallback<unknown, Record<string, unknown>>;
type AnyCommandsCallback = FacadeCommandsCallback<unknown, FacadeCommandResult>;

type IgniteCoreReturn<
	State,
	Event,
	Snapshot,
	StateCallback extends
		| FacadeStatesCallback<Snapshot, Record<string, unknown>>
		| undefined,
	CommandActor,
	CommandCallback extends
		| FacadeCommandsCallback<CommandActor, FacadeCommandResult>
		| undefined,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		Snapshot,
		StateCallback,
		CommandActor,
		CommandCallback
	>
>;

type ReduxBlueprintSource = Slice | (() => EnhancedStore);
type ReduxInstanceSource = EnhancedStore;

type ReduxCommandActorFor<Source> = Source extends Slice
	? ReduxSliceCommandActor<Source>
	: Source extends () => EnhancedStore
		? ReduxStoreCommandActor<ReturnType<Source>>
		: Source extends EnhancedStore
			? ReduxStoreCommandActor<Source>
			: never;

export type InferAdapterFromSource<Source> = Source extends AnyStateMachine
	? "xstate"
	: Source extends XStateActorInstance<AnyStateMachine>
		? "xstate"
		: Source extends () => infer Result
			? Result extends EnhancedStore
				? "redux"
				: Result extends object
					? "mobx"
					: never
			: Source extends EnhancedStore
				? "redux"
				: Source extends Slice
					? "redux"
					: Source extends object
						? "mobx"
						: never;

type XStateConfig<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined,
> = {
	adapter?: "xstate";
	source: Machine | XStateActorInstance<Machine>;
	states?: StateCallback;
	commands?: CommandCallback;
	cleanup?: boolean;
};

type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<ReduxCommandActorFor<Source>, FacadeCommandResult>
		| undefined,
> = {
	adapter?: "redux";
	source: Source;
	states?: StateCallback;
	commands?: CommandCallback;
	cleanup?: boolean;
};

type ReduxInstanceConfig<
	StoreInstance extends ReduxInstanceSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<StoreInstance>,
				FacadeCommandResult
		  >
		| undefined,
> = {
	adapter?: "redux";
	source: StoreInstance;
	states?: StateCallback;
	commands?: CommandCallback;
	cleanup?: boolean;
};

type MobxConfig<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined,
> = {
	adapter?: "mobx";
	source: (() => State) | State;
	states?: StateCallback;
	commands?: CommandCallback;
	cleanup?: boolean;
};

export type IgniteCoreConfig =
	| {
			adapter?: "xstate";
			source: AnyStateMachine | XStateActorInstance<AnyStateMachine>;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			cleanup?: boolean;
	  }
	| {
			adapter?: "redux";
			source: Slice | EnhancedStore | (() => EnhancedStore);
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			cleanup?: boolean;
	  }
	| {
			adapter?: "mobx";
			source: (() => object) | object;
			states?: AnyStatesCallback;
			commands?: AnyCommandsCallback;
			cleanup?: boolean;
	  };

// Overload for XState
export function igniteCore<
	Machine extends AnyStateMachine,
	StateCallback extends
		| FacadeStatesCallback<ExtendedState<Machine>, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<XStateActorInstance<Machine>, FacadeCommandResult>
		| undefined,
>(
	options: XStateConfig<Machine, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StateCallback,
	XStateActorInstance<Machine>,
	CommandCallback
>;

// Overload for Redux - Blueprint (slice or store factory)
export function igniteCore<
	Source extends ReduxBlueprintSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<Source>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<ReduxCommandActorFor<Source>, FacadeCommandResult>
		| undefined,
>(
	options: ReduxBlueprintConfig<Source, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	StateCallback,
	ReduxCommandActorFor<Source>,
	CommandCallback
>;

// Overload for Redux - Store instance
export function igniteCore<
	StoreInstance extends ReduxInstanceSource,
	StateCallback extends
		| FacadeStatesCallback<
				InferStateAndEvent<StoreInstance>["State"],
				Record<string, unknown>
		  >
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<
				ReduxCommandActorFor<StoreInstance>,
				FacadeCommandResult
		  >
		| undefined,
>(
	options: ReduxInstanceConfig<StoreInstance, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	InferStateAndEvent<StoreInstance>["State"],
	InferStateAndEvent<StoreInstance>["Event"],
	InferStateAndEvent<StoreInstance>["State"],
	StateCallback,
	ReduxCommandActorFor<StoreInstance>,
	CommandCallback
>;

// Overload for MobX
export function igniteCore<
	State extends object,
	StateCallback extends
		| FacadeStatesCallback<State, Record<string, unknown>>
		| undefined,
	CommandCallback extends
		| FacadeCommandsCallback<State, FacadeCommandResult>
		| undefined,
>(
	options: MobxConfig<State, StateCallback, CommandCallback>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StateCallback,
	State,
	CommandCallback
>;

// Unified Implementation
export function igniteCore(options: IgniteCoreConfig) {
	const adapterName = resolveAdapter(options);

	switch (adapterName) {
		case "xstate": {
			const adapterFactory = createXStateAdapter(
				options.source as
					| AnyStateMachine
					| XStateActorInstance<AnyStateMachine>,
			);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
				cleanup: options.cleanup,
			});
		}

		case "redux": {
			const source = options.source;
			if (isReduxStore(source)) {
				const adapterFactory = createReduxAdapter(source);
				return createComponentFactory(adapterFactory, {
					scope: adapterFactory.scope,
					states: options.states,
					commands: options.commands,
					cleanup: options.cleanup,
				});
			}

			if (typeof source === "function") {
				const adapterFactory = createReduxAdapter(
					source as () => EnhancedStore,
				);
				return createComponentFactory(adapterFactory, {
					scope: adapterFactory.scope,
					states: options.states,
					commands: options.commands,
					cleanup: options.cleanup,
				});
			}

			if (isReduxSlice(source)) {
				const adapterFactory = createReduxAdapter(source);
				return createComponentFactory(adapterFactory, {
					scope: adapterFactory.scope,
					states: options.states,
					commands: options.commands,
					cleanup: options.cleanup,
				});
			}

			throw new Error(
				"[igniteCore] Unable to resolve redux source; please specify the adapter explicitly.",
			);
		}

		case "mobx": {
			const adapterFactory = createMobXAdapter(options.source);
			return createComponentFactory(adapterFactory, {
				scope: adapterFactory.scope,
				states: options.states,
				commands: options.commands,
				cleanup: options.cleanup,
			});
		}

		default: {
			return assertNever(adapterName);
		}
	}
}

type ResolvedAdapter = "xstate" | "redux" | "mobx";

function resolveAdapter(options: IgniteCoreConfig): ResolvedAdapter {
	if (options.adapter) {
		return options.adapter;
	}

	const { source } = options;

	if (isXStateActor(source) || isXStateMachine(source)) {
		return "xstate";
	}

	if (isReduxStore(source) || isReduxSlice(source)) {
		return "redux";
	}

	if (typeof source === "function") {
		const inferred = inferFromFactory(source as () => unknown);
		if (inferred) {
			return inferred;
		}
	}

	if (isMobxObservable(source)) {
		return "mobx";
	}

	throw new Error(
		"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
	);
}

function inferFromFactory(
	factory: () => unknown,
): Extract<ResolvedAdapter, "redux" | "mobx"> | undefined {
	try {
		const candidate = factory();
		if (isReduxStore(candidate)) {
			return "redux";
		}
		if (isMobxObservable(candidate)) {
			return "mobx";
		}
	} catch (error) {
		throw new Error(
			`[igniteCore] Failed to execute source factory while inferring adapter. Specify the adapter explicitly. Original error: ${String(
				error,
			)}`,
		);
	}

	return undefined;
}

function assertNever(adapter: unknown): never {
	throw new Error(`Unsupported adapter: ${String(adapter)}`);
}
