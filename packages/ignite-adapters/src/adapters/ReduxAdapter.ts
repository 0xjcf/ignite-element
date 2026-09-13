import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeEffectsObjectCallback,
	FacadeStatesCallback,
	IgniteAdapter,
} from "@ignite-element/core";
import { failInvariant, StateScope } from "@ignite-element/core";
import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import type { InferStateAndEvent } from "../utils/igniteRedux";
import { isReduxSlice, isReduxStore } from "../utils/reduxGuards";

const isStoreFactory = (value: unknown): value is () => EnhancedStore =>
	typeof value === "function" && !isReduxStore(value);

type AdapterFactory<State, Event, Snapshot, Actor> = (() => IgniteAdapter<
	State,
	Event
>) & {
	scope: StateScope;
	resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => Actor;
};

type AdapterEntry<State, Event, Snapshot, Actor> = {
	adapter: IgniteAdapter<State, Event>;
	snapshot: () => Snapshot;
	actor: Actor;
};

type StoreSubscription = (listener: () => void) => () => void;

type StoreLike<State, Event> = {
	dispatch: (event: Event) => unknown;
	getState: () => State;
	subscribe: StoreSubscription;
};

const stoppedSubscribeWarning =
	"[ReduxAdapter] Cannot subscribe when adapter is stopped.";

function requireEntry<State, Event, Snapshot, Actor>(
	registry: WeakMap<
		IgniteAdapter<State, Event>,
		AdapterEntry<State, Event, Snapshot, Actor>
	>,
	adapter: IgniteAdapter<State, Event>,
	errorMessage: string,
): AdapterEntry<State, Event, Snapshot, Actor> {
	const entry = registry.get(adapter);
	return entry ?? failInvariant(errorMessage);
}

const buildAdapter = <State, Event>(
	store: StoreLike<State, Event>,
	scope: StateScope,
): IgniteAdapter<State, Event> => {
	type Snapshot = State;

	const unsubscribers = new Set<() => void>();
	let isStopped = false;
	let lastKnownState: Snapshot = store.getState();

	const cleanupSubscriptions = () => {
		for (const unsubscribe of unsubscribers) {
			unsubscribe();
		}
		unsubscribers.clear();
	};

	const adapter: IgniteAdapter<State, Event> = {
		subscribeSnapshots(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
			}

			listener(store.getState());
			const storeUnsubscribe = store.subscribe(() => {
				listener(store.getState());
			});

			const unsubscribe = () => {
				if (!unsubscribers.delete(unsubscribe)) {
					return;
				}
				storeUnsubscribe();
			};

			unsubscribers.add(unsubscribe);

			return {
				unsubscribe,
			};
		},
		send(event) {
			if (isStopped) {
				console.warn(
					"[ReduxAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}
			store.dispatch(event);
			lastKnownState = store.getState();
		},
		getSnapshot() {
			return isStopped ? lastKnownState : store.getState();
		},
		stop() {
			cleanupSubscriptions();
			isStopped = true;
		},
		scope,
	};

	return adapter;
};

function createSharedFactory<State, Event, Snapshot, Actor>(
	entry: AdapterEntry<State, Event, Snapshot, Actor>,
): AdapterFactory<State, Event, Snapshot, Actor> {
	const factory: AdapterFactory<State, Event, Snapshot, Actor> = Object.assign(
		() => entry.adapter,
		{
			scope: StateScope.Shared,
			resolveStateSnapshot: () => entry.snapshot(),
			resolveCommandActor: () => entry.actor,
		},
	);
	return factory;
}

function createIsolatedFactory<State, Event, Snapshot, Actor>(
	createEntry: () => AdapterEntry<State, Event, Snapshot, Actor>,
): AdapterFactory<State, Event, Snapshot, Actor> {
	const registry = new WeakMap<
		IgniteAdapter<State, Event>,
		AdapterEntry<State, Event, Snapshot, Actor>
	>();

	const factory: AdapterFactory<State, Event, Snapshot, Actor> = Object.assign(
		() => {
			const entry = createEntry();
			registry.set(entry.adapter, entry);
			return entry.adapter;
		},
		{
			scope: StateScope.Isolated,
			resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => {
				return requireEntry(
					registry,
					adapter,
					"[ReduxAdapter] Unable to resolve snapshot for facade callbacks.",
				).snapshot();
			},
			resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => {
				return requireEntry(
					registry,
					adapter,
					"[ReduxAdapter] Unable to resolve actor for facade callbacks.",
				).actor;
			},
		},
	);

	return factory;
}

export default function createReduxAdapter<Source extends Slice>(
	source: Source,
): AdapterFactory<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	ReduxSliceCommandActor<Source>
>;
export default function createReduxAdapter<Source extends () => EnhancedStore>(
	source: Source,
): AdapterFactory<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	ReduxStoreCommandActor<ReturnType<Source>>
>;
export default function createReduxAdapter<Source extends EnhancedStore>(
	source: Source,
): AdapterFactory<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	ReduxStoreCommandActor<Source>
>;
export default function createReduxAdapter(
	source: Slice | (() => EnhancedStore) | EnhancedStore,
) {
	if (isReduxStore(source)) {
		const store = source;
		type StoreInstance = typeof store;
		type State = ReturnType<StoreInstance["getState"]>;
		type Event = Parameters<StoreInstance["dispatch"]>[0];

		const adapter = buildAdapter<State, Event>(store, StateScope.Shared);

		const dispatch: ReduxStoreCommandActor<StoreInstance>["dispatch"] = (
			event,
		) => store.dispatch(event);
		const subscribe: ReduxStoreCommandActor<StoreInstance>["subscribe"] =
			store.subscribe.bind(store);
		const actor: ReduxStoreCommandActor<StoreInstance> = {
			dispatch,
			getState: () => store.getState(),
			subscribe,
		};

		const entry: AdapterEntry<
			State,
			Event,
			State,
			ReduxStoreCommandActor<StoreInstance>
		> = {
			adapter,
			snapshot: () => store.getState(),
			actor,
		};

		return createSharedFactory(entry);
	}

	if (isStoreFactory(source)) {
		const createStore = source;
		type StoreCreator = typeof createStore;
		type StoreInstance = ReturnType<StoreCreator>;
		type State = ReturnType<StoreInstance["getState"]>;
		type Event = Parameters<StoreInstance["dispatch"]>[0];

		return createIsolatedFactory<
			State,
			Event,
			State,
			ReduxStoreCommandActor<StoreInstance>
		>(() => {
			const store = createStore();
			if (!isReduxStore(store)) {
				return failInvariant(
					"[ReduxAdapter] store factory must return a Redux store instance.",
				);
			}

			const adapter = buildAdapter<State, Event>(store, StateScope.Isolated);

			const dispatch: ReduxStoreCommandActor<StoreInstance>["dispatch"] = (
				event,
			) => store.dispatch(event);
			const subscribe: ReduxStoreCommandActor<StoreInstance>["subscribe"] =
				store.subscribe.bind(store);
			const actor: ReduxStoreCommandActor<StoreInstance> = {
				dispatch,
				getState: () => store.getState(),
				subscribe,
			};

			return {
				adapter,
				snapshot: () => store.getState(),
				actor,
			};
		});
	}

	if (!isReduxSlice(source)) {
		return failInvariant(
			"[ReduxAdapter] source must be a Redux store, slice, or store factory.",
		);
	}

	const slice = source;
	type SliceSource = typeof slice;
	type State = InferStateAndEvent<SliceSource>["State"];
	type Event = InferStateAndEvent<SliceSource>["Event"];

	return createIsolatedFactory<
		State,
		Event,
		State,
		ReduxSliceCommandActor<SliceSource>
	>(() => {
		const store = configureStore({
			reducer: {
				[slice.name]: slice.reducer,
			},
		});

		const getSliceState = (): State => store.getState()[slice.name] as State;
		const sliceStore: StoreLike<State, Event> = {
			dispatch: (event) => store.dispatch(event),
			getState: getSliceState,
			subscribe: store.subscribe.bind(store),
		};

		const adapter = buildAdapter<State, Event>(sliceStore, StateScope.Isolated);

		const dispatch: ReduxSliceCommandActor<SliceSource>["dispatch"] = (event) =>
			store.dispatch(event);
		const subscribe: ReduxSliceCommandActor<SliceSource>["subscribe"] = (
			listener,
		) => {
			const unsubscribe = store.subscribe(listener);
			return () => unsubscribe();
		};

		const actor: ReduxSliceCommandActor<SliceSource> = {
			dispatch,
			getState: getSliceState,
			subscribe,
		};

		return {
			adapter,
			snapshot: getSliceState,
			actor,
		};
	});
}

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

export type ReduxBlueprintSource = Slice | (() => EnhancedStore);
export type ReduxInstanceSource = EnhancedStore;

export type ReduxCommandActorFor<Source> = Source extends Slice
	? ReduxSliceCommandActor<Source>
	: Source extends () => EnhancedStore
		? ReduxStoreCommandActor<ReturnType<Source>>
		: Source extends EnhancedStore
			? ReduxStoreCommandActor<Source>
			: never;

type ReduxBlueprintBaseConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "redux";
	source: Source;
	states?: FacadeStatesCallback<
		InferStateAndEvent<Source>["State"],
		StatesResult
	>;
	commands?: FacadeCommandsCallback<
		ReduxCommandActorFor<Source>,
		CommandsResult,
		Host,
		InferStateAndEvent<Source>["State"]
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type ReduxBlueprintEffectsConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap,
> = {
	effects?: FacadeEffectsObjectCallback<
		InferStateAndEvent<Source>["State"],
		ReduxCommandActorFor<Source>,
		Events
	>;
};

export type ReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = ReduxBlueprintBaseConfig<
	Source,
	Events,
	StatesResult,
	CommandsResult,
	Host
> &
	ReduxBlueprintEffectsConfig<Source, Events>;

type ReduxInstanceBaseConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = {
	adapter?: "redux";
	source: StoreInstance;
	states?: FacadeStatesCallback<
		InferStateAndEvent<StoreInstance>["State"],
		StatesResult
	>;
	commands?: FacadeCommandsCallback<
		ReduxCommandActorFor<StoreInstance>,
		CommandsResult,
		Host,
		InferStateAndEvent<StoreInstance>["State"]
	>;
	events?: EventsDefinition<Events>;
	cleanup?: boolean;
};

type ReduxInstanceEffectsConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap,
> = {
	effects?: FacadeEffectsObjectCallback<
		InferStateAndEvent<StoreInstance>["State"],
		ReduxCommandActorFor<StoreInstance>,
		Events
	>;
};

export type ReduxInstanceConfig<
	StoreInstance extends ReduxInstanceSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Host = unknown,
> = ReduxInstanceBaseConfig<
	StoreInstance,
	Events,
	StatesResult,
	CommandsResult,
	Host
> &
	ReduxInstanceEffectsConfig<StoreInstance, Events>;
