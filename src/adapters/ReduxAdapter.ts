import { Store } from "redux";
import { Action } from "@reduxjs/toolkit";
import IgniteAdapter from "../IgniteAdapter";

export default function createReduxAdapter<State, Event extends Action<string>>(
  configureStore: () => Store<State, Event>
): () => IgniteAdapter<State, Event> {
  return () => {
    const store = configureStore();
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
        store.dispatch(event);
        lastKnownState = store.getState();
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        if (isStopped) {
          return lastKnownState;
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
