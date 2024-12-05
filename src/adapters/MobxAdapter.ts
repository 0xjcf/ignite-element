import { autorun } from "mobx";
import IgniteAdapter from "../IgniteAdapter";

export type FunctionKeys<StateType> = {
  [Key in keyof StateType]: StateType[Key] extends (...args: any[]) => any
    ? Key
    : never;
}[keyof StateType];

export default function createMobXAdapter<State extends Record<string, any>>(
  storeFactory: () => State
): () => IgniteAdapter<State, { type: FunctionKeys<State> }> {
  return () => {
    const store = storeFactory();
    let unsubscribe: (() => void) | null = null;
    let isStopped = false;
    let lastKnownState: State = { ...store };

    function cleanupAutorun() {
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

        unsubscribe = autorun(() => {
          listener({ ...store });
        });

        return {
          unsubscribe: () => {
            if (isStopped) return; // Prevent unsubscription actions after stopping
            cleanupAutorun();
          },
        };
      },
      /**
       * Dispatch an action (send an event)
       */
      send(event: { type: FunctionKeys<State> }) {
        if (isStopped) {
          console.warn(
            "[MobxAdapter] Cannot send events when adapter is stopped."
          );
          return;
        }
        const action = store[event.type];
        if (typeof action === "function") {
          action.call(store, event);
          lastKnownState = { ...store }; // Update the last known state after an action
        } else {
          console.warn(
            `[MobxAdapter] Unknown event type: ${String(event.type)}`
          );
        }
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        if (isStopped) {
          return lastKnownState; // Return the cached state after stopping
        }
        return { ...store };
      },
      /**
       * Stop the adapter
       */
      stop() {
        cleanupAutorun(); // Clean up the single listener
        isStopped = true; // Mark the adapter as stopped
      },
    };
  };
}
