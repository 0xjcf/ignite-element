import { Store } from "redux";
import { IgniteAdapter } from "../IgniteAdapter";
import { Action } from "@reduxjs/toolkit";

export default function createReduxAdapter<State, Event extends Action<string>>(
  configureStore: () => Store<State, Event>
): () => IgniteAdapter<State, Event> {
  return () => {
    const store = configureStore();
    let unsubscribe: (() => void) | null = null;

    function cleanupSubscribe() {
      unsubscribe?.();
      unsubscribe = null;
    }

    return {
      /**
       * Subscribe to state changes
       */
      subscribe(listener) {
        unsubscribe = store.subscribe(() => listener(store.getState()));
        return {
          unsubscribe: cleanupSubscribe,
        };
      },
      /**
       * Dispatch an action (send an event)
       */
      send(event) {
        store.dispatch(event);
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        return store.getState();
      },
      /**
       * Stop the adapter
       */
      stop() {
        cleanupSubscribe();
      },
    };
  };
}
