import { Store } from "redux";
import { IgniteAdapter } from "./IgniteAdapter";
import { Action } from "@reduxjs/toolkit";

export function createReduxAdapter<State, Event extends Action<string>>(
  store: Store<State, Event>
): IgniteAdapter<State, Event> {
  let unsubscribe: (() => void) | null;

  return {
    subscribe(listener) {
      unsubscribe = store.subscribe(() => listener(store.getState()));
      return {
        unsubscribe: () => {
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
        },
      };
    },
    send(event) {
      store.dispatch(event);
    },
    getState() {
      return store.getState();
    },
    stop() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  };
}
