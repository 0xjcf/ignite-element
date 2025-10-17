import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import { isReduxStore } from "../utils/adapterGuards";
import type { InferStateAndEvent, ReduxActions } from "../utils/igniteRedux";

const isStoreFactory = (value: unknown): value is () => EnhancedStore => {
	if (typeof value !== "function") {
		return false;
	}

	// When the value is already a Redux store (stores are objects), `isReduxStore`
	// handles the shared branch, so we only need to ensure we don't misclassify
	// those here. Any further validation happens when the factory output is used.
	return !isReduxStore(value);
};

// Redux Adapter for Slice or Store
type ReduxAdapterFactory<State, Event> = (() => IgniteAdapter<State, Event>) & {
	scope: StateScope;
};

export default function createReduxAdapter<Source extends Slice>(
	source: Source,
): ReduxAdapterFactory<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"]
>;
export default function createReduxAdapter<
	StoreCreator extends () => EnhancedStore,
	Actions extends ReduxActions,
>(
	source: StoreCreator,
	actions: Actions,
): ReduxAdapterFactory<
	InferStateAndEvent<StoreCreator, Actions>["State"],
	InferStateAndEvent<StoreCreator, Actions>["Event"]
>;
export default function createReduxAdapter<
	StoreInstance extends EnhancedStore,
	Actions extends ReduxActions,
>(
	source: StoreInstance,
	actions: Actions,
): ReduxAdapterFactory<
	InferStateAndEvent<StoreInstance, Actions>["State"],
	InferStateAndEvent<StoreInstance, Actions>["Event"]
>;
export default function createReduxAdapter<
	SharedSource extends (() => EnhancedStore) | EnhancedStore,
	Actions extends ReduxActions,
>(
	source: SharedSource,
	actions: Actions,
): ReduxAdapterFactory<
	InferStateAndEvent<SharedSource, Actions>["State"],
	InferStateAndEvent<SharedSource, Actions>["Event"]
>;
export default function createReduxAdapter<
	Source extends Slice | (() => EnhancedStore) | EnhancedStore,
	Actions extends ReduxActions | undefined,
>(
	source: Source,
	actions?: Actions,
): ReduxAdapterFactory<
	InferStateAndEvent<Source, Actions>["State"],
	InferStateAndEvent<Source, Actions>["Event"]
> {
	const buildAdapter = <
		Store extends Pick<EnhancedStore, "dispatch" | "getState" | "subscribe">,
		Event extends Parameters<Store["dispatch"]>[0] = Parameters<
			Store["dispatch"]
		>[0],
	>(
		store: Store,
		scope: StateScope,
	): IgniteAdapter<ReturnType<Store["getState"]>, Event> => {
		type State = ReturnType<Store["getState"]>;

		let unsubscribe: (() => void) | null = null;
		let isStopped = false;
		let lastKnownState: State = store.getState();

		function cleanupSubscribe() {
			unsubscribe?.();
			unsubscribe = null;
		}

		const adapter: IgniteAdapter<State, Event> = {
			subscribe(listener) {
				if (isStopped) {
					console.warn("Adapter is stopped and cannot subscribe.");
				}

				listener(store.getState());
				unsubscribe = store.subscribe(() => {
					listener(store.getState());
				});

				return {
					unsubscribe: () => {
						if (isStopped) {
							return;
						}
						cleanupSubscribe();
					},
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
			getState() {
				return isStopped ? lastKnownState : store.getState();
			},
			stop() {
				cleanupSubscribe();
				isStopped = true;
			},
			scope,
		};

		return adapter;
	};

	const createScopedFactory = <State, Event>(
		initializer: () => IgniteAdapter<State, Event>,
		scope: StateScope,
	): ReduxAdapterFactory<State, Event> => {
		const factory = () => initializer();
		return Object.assign(factory, { scope });
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

	if (isReduxStore(source)) {
		if (!actions) {
			throw new Error(
				"[ReduxAdapter] actions are required when providing a store instance.",
			);
		}

		const store = source;
		type StoreInstance = typeof store;
		type State = InferStateAndEvent<StoreInstance, Actions>["State"];
		type Event = InferStateAndEvent<StoreInstance, Actions>["Event"];

		return createScopedFactory<State, Event>(
			() =>
				adaptEvent(
					buildAdapter(store, StateScope.Shared),
					// Cast back to the store's dispatch event shape while exposing a
					// narrower `Event` type to consumers.
					(event) => event as Parameters<StoreInstance["dispatch"]>[0],
				),
			StateScope.Shared,
		);
	}

	if (isStoreFactory(source)) {
		if (!actions) {
			throw new Error(
				"[ReduxAdapter] actions are required when providing a store factory.",
			);
		}

		const storeFactory = source;
		type StoreCreator = typeof storeFactory;
		type State = InferStateAndEvent<StoreCreator, Actions>["State"];
		type Event = InferStateAndEvent<StoreCreator, Actions>["Event"];

		return createScopedFactory<State, Event>(() => {
			const store = storeFactory();
			if (!isReduxStore(store)) {
				throw new Error(
					"[ReduxAdapter] store factory must return a Redux store instance.",
				);
			}
			type StoreInstance = typeof store;
			return adaptEvent(
				buildAdapter(store, StateScope.Isolated),
				// Cast back to the store's dispatch event shape while exposing a
				// narrower `Event` type to consumers.
				(event) => event as Parameters<StoreInstance["dispatch"]>[0],
			);
		}, StateScope.Isolated);
	}

	type SliceSource = Extract<Source, Slice>;
	const slice = source as SliceSource;
	type State = InferStateAndEvent<SliceSource, Actions>["State"];
	type Event = InferStateAndEvent<SliceSource, Actions>["Event"];

	return createScopedFactory<State, Event>(() => {
		const store = configureStore({
			reducer: {
				[slice.name]: slice.reducer,
			},
		});
		type StoreInstance = typeof store;
		return adaptEvent(
			buildAdapter(store, StateScope.Isolated),
			// Cast back to the store's dispatch event shape while exposing a
			// narrower `Event` type to consumers.
			(event) => event as Parameters<StoreInstance["dispatch"]>[0],
		);
	}, StateScope.Isolated);
}
