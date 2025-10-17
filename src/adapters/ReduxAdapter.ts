import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import { configureStore } from "@reduxjs/toolkit";
import type IgniteAdapter from "../IgniteAdapter";
import type { InferStateAndEvent, ReduxActions } from "../utils/igniteRedux";

// Redux Adapter for Slice or Store
export default function createReduxAdapter<Source extends Slice>(
	source: Source,
): () => IgniteAdapter<
	InferStateAndEvent<Source>["State"],
	InferStateAndEvent<Source>["Event"]
>;
export default function createReduxAdapter<
	StoreCreator extends () => EnhancedStore,
	Actions extends ReduxActions,
>(
	source: StoreCreator,
	_actions: Actions,
): () => IgniteAdapter<
	InferStateAndEvent<StoreCreator, Actions>["State"],
	InferStateAndEvent<StoreCreator, Actions>["Event"]
>;
export default function createReduxAdapter<
	Source extends Slice | (() => EnhancedStore),
	Actions extends ReduxActions | undefined,
>(
	source: Source,
	_actions?: Actions,
): () => IgniteAdapter<
	InferStateAndEvent<Source, Actions>["State"],
	InferStateAndEvent<Source, Actions>["Event"]
> {
	return () => {
		// Create a new store instance for each component
		const store: EnhancedStore =
			typeof source === "function"
				? source() // Pre-configured store
				: configureStore({
						reducer: {
							[source.name]: source.reducer, // Create store from slice reducer
						},
					});

		let unsubscribe: (() => void) | null = null;
		let isStopped = false;
		let lastKnownState = store.getState();

		function cleanupSubscribe() {
			unsubscribe?.();
			unsubscribe = null;
		}

		return {
			/**
			 * Subscribe to state changes
			 */
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
						if (isStopped) return;
						cleanupSubscribe();
					},
				};
			},

			/**
			 * Dispatch an action (send an event)
			 */
			send(event) {
				if (isStopped) {
					console.warn(
						"[ReduxAdapter] Cannot send events when adapter is stopped.",
					);
					return;
				}
				store.dispatch(event); // Dispatch the event
				lastKnownState = store.getState();
			},

			/**
			 * Get the current state snapshot
			 */
			getState() {
				if (isStopped) {
					return lastKnownState; // Return cached state after stop
				}
				return store.getState();
			},

			/**
			 * Stop the adapter
			 */
			stop() {
				cleanupSubscribe();
				isStopped = true;
			},
		};
	};
}
