import { autorun } from "mobx";
import { IgniteAdapter } from "../IgniteAdapter";

type FunctionKeys<StateType> = {
  [Key in keyof StateType]: StateType[Key] extends (...args: any[]) => any
    ? Key
    : never;
}[keyof StateType];

export default function createMobXAdapter<State extends Record<string, any>>(
  storeFactory: () => State
): () => IgniteAdapter<State, { type: FunctionKeys<State> }> {
  return () => {
    const store = storeFactory();
    let stopAutorun: (() => void) | null = null;

    function cleanupAutorun() {
      stopAutorun?.();
      stopAutorun = null;
    }

    return {
      /**
       * Subscribe to state changes
       */
      subscribe(listener) {
        stopAutorun = autorun(() => listener(store));
        return {
          unsubscribe: cleanupAutorun,
        };
      },
      /**
       * Dispatch an action (send an event)
       */
      send(event: { type: FunctionKeys<State> }) {
        const action = store[event.type];
        if (typeof action === "function") {
          action.call(store, event);
        } else {
          console.warn(
            `[MobXAdapter] Unknown event type: ${String(event.type)}`
          );
        }
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        return store;
      },
      /**
       * Stop the adapter
       */
      stop() {
        cleanupAutorun();
      },
    };
  };
}
