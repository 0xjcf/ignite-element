import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import type {
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../RenderArgs";
import { isReduxStore } from "../utils/adapterGuards";
import type { InferStateAndEvent } from "../utils/igniteRedux";

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

const adaptEvent = <State, DispatchEvent, Event>(
	adapter: IgniteAdapter<State, DispatchEvent>,
	toDispatch: (event: Event) => DispatchEvent,
): IgniteAdapter<State, Event> => ({
	subscribe: adapter.subscribe,
	send(event) {
		adapter.send(toDispatch(event));
	},
	getState: adapter.getState,
	stop: adapter.stop,
	scope: adapter.scope,
});

const buildAdapter = <
	Store extends Pick<EnhancedStore, "dispatch" | "getState" | "subscribe">,
	Event,
>(
	store: Store,
	scope: StateScope,
): IgniteAdapter<ReturnType<Store["getState"]>, Event> => {
	type State = ReturnType<Store["getState"]>;

	const unsubscribers = new Set<() => void>();
	let isStopped = false;
	let lastKnownState: State = store.getState();

	const cleanupSubscriptions = () => {
		for (const unsubscribe of unsubscribers) {
			unsubscribe();
		}
		unsubscribers.clear();
	};

	const adapter: IgniteAdapter<State, Event> = {
		subscribe(listener) {
			if (isStopped) {
				console.warn("Adapter is stopped and cannot subscribe.");
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
			store.dispatch(event as Parameters<typeof store.dispatch>[0]);
			lastKnownState = store.getState();
		},
		getState() {
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
	const factory = (() => entry.adapter) as AdapterFactory<
		State,
		Event,
		Snapshot,
		Actor
	>;
	factory.scope = StateScope.Shared;
	factory.resolveStateSnapshot = () => entry.snapshot();
	factory.resolveCommandActor = () => entry.actor;
	return factory;
}

function createIsolatedFactory<State, Event, Snapshot, Actor>(
	createEntry: () => AdapterEntry<State, Event, Snapshot, Actor>,
): AdapterFactory<State, Event, Snapshot, Actor> {
	const registry = new WeakMap<
		IgniteAdapter<State, Event>,
		AdapterEntry<State, Event, Snapshot, Actor>
	>();

	const factory = (() => {
		const entry = createEntry();
		registry.set(entry.adapter, entry);
		return entry.adapter;
	}) as AdapterFactory<State, Event, Snapshot, Actor>;

	factory.scope = StateScope.Isolated;
	factory.resolveStateSnapshot = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[ReduxAdapter] Unable to resolve snapshot for facade callbacks.",
			);
		}
		return entry.snapshot();
	};
	factory.resolveCommandActor = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[ReduxAdapter] Unable to resolve actor for facade callbacks.",
			);
		}
		return entry.actor;
	};

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
export default function createReduxAdapter<
	Source extends Slice | (() => EnhancedStore) | EnhancedStore,
>(
	source: Source,
): AdapterFactory<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"],
	InferStateAndEvent<Source>["State"],
	unknown
> {
	if (isReduxStore(source)) {
		const store = source;
		type StoreInstance = typeof store;
		type State = InferStateAndEvent<StoreInstance>["State"];
		type Event = InferStateAndEvent<StoreInstance>["Event"];

		const adapter = adaptEvent<
			State,
			Parameters<StoreInstance["dispatch"]>[0],
			Event
		>(
			buildAdapter(store, StateScope.Shared),
			(event) => event as Parameters<StoreInstance["dispatch"]>[0],
		);

		const dispatch: ReduxStoreCommandActor<StoreInstance>["dispatch"] = (
			event,
		) =>
			store.dispatch(
				event as Parameters<StoreInstance["dispatch"]>[0],
			) as ReturnType<StoreInstance["dispatch"]>;
		const actor: ReduxStoreCommandActor<StoreInstance> = {
			dispatch,
			getState: () => store.getState() as State,
			subscribe: store.subscribe.bind(
				store,
			) as ReduxStoreCommandActor<StoreInstance>["subscribe"],
		};

		const entry: AdapterEntry<
			State,
			Event,
			State,
			ReduxStoreCommandActor<StoreInstance>
		> = {
			adapter,
			snapshot: () => store.getState() as State,
			actor,
		};

		return createSharedFactory(entry);
	}

	if (isStoreFactory(source)) {
		const createStore = source;
		type StoreCreator = typeof createStore;
		type StoreInstance = ReturnType<StoreCreator>;
		type State = InferStateAndEvent<StoreCreator>["State"];
		type Event = InferStateAndEvent<StoreCreator>["Event"];

		return createIsolatedFactory<
			State,
			Event,
			State,
			ReduxStoreCommandActor<StoreInstance>
		>(() => {
			const store = createStore();
			if (!isReduxStore(store)) {
				throw new Error(
					"[ReduxAdapter] store factory must return a Redux store instance.",
				);
			}

			const adapter = adaptEvent<
				State,
				Parameters<StoreInstance["dispatch"]>[0],
				Event
			>(
				buildAdapter(store, StateScope.Isolated),
				(event) => event as Parameters<StoreInstance["dispatch"]>[0],
			);

			const dispatch: ReduxStoreCommandActor<StoreInstance>["dispatch"] = (
				event,
			) =>
				store.dispatch(
					event as Parameters<StoreInstance["dispatch"]>[0],
				) as ReturnType<StoreInstance["dispatch"]>;
			const actor: ReduxStoreCommandActor<StoreInstance> = {
				dispatch,
				getState: () => store.getState() as State,
				subscribe: store.subscribe.bind(
					store,
				) as ReduxStoreCommandActor<StoreInstance>["subscribe"],
			};

			return {
				adapter,
				snapshot: () => store.getState() as State,
				actor,
			};
		});
	}

	type SliceSource = Extract<Source, Slice>;
	const slice = source as SliceSource;
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
		type StoreInstance = typeof store;

		const adapter = adaptEvent<
			State,
			Parameters<StoreInstance["dispatch"]>[0],
			Event
		>(
			buildAdapter(store, StateScope.Isolated),
			(event) => event as Parameters<StoreInstance["dispatch"]>[0],
		);

		const dispatch: ReduxSliceCommandActor<SliceSource>["dispatch"] = (event) =>
			store.dispatch(event as Parameters<StoreInstance["dispatch"]>[0]);
		const subscribe: ReduxSliceCommandActor<SliceSource>["subscribe"] = (
			listener,
		) => {
			const unsubscribe = store.subscribe(listener);
			return () => unsubscribe();
		};

		const actor: ReduxSliceCommandActor<SliceSource> = {
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
