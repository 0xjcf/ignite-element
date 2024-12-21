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
  // Create the store based on the source type
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

  return () => ({
    subscribe(listener) {
      if (isStopped) {
        throw new Error("Adapter is stopped and cannot subscribe.");
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

    send(event) {
      if (isStopped) {
        console.warn(
          "[ReduxAdapter] Cannot send events when adapter is stopped."
        );
        return;
      }
      store.dispatch(event);
      lastKnownState = store.getState();
    },

    getState() {
      if (isStopped) {
        return lastKnownState;
      }
      return store.getState();
    },

    stop() {
      cleanupSubscribe();
      isStopped = true;
    },
  });
}
