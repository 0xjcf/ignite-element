import { EnhancedStore, configureStore, Slice } from "@reduxjs/toolkit";
import IgniteAdapter from "../IgniteAdapter";
import { InferStateAndEvent } from "../utils/igniteRedux";

// Redux Adapter for Slice or Store
export default function createReduxAdapter<
  Source extends Slice | (() => EnhancedStore)
>(
  source: Source
): () => IgniteAdapter<
  InferStateAndEvent<Source>["State"],
  InferStateAndEvent<Source>["Event"]
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
            "[ReduxAdapter] Cannot send events when adapter is stopped."
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
