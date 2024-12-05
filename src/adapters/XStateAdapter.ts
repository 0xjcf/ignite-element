import { AnyStateMachine, StateFrom, EventFrom, createActor } from "xstate";
import IgniteAdapter from "../IgniteAdapter";

export default function createXStateAdapter<Machine extends AnyStateMachine>(
  machine: Machine
): () => IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>> {
  return () => {
    const actor = createActor(machine);
    actor.start();
    let subscription: { unsubscribe: () => void } | null = null;
    let isStopped = false;
    let lastKnownState = actor.getSnapshot();

    function cleanupSubscribe() {
      subscription?.unsubscribe();
      subscription = null;
    }

    return {
      /**
       * Subscribe to state changes
       */
      subscribe(listener) {
        if (isStopped) {
          throw new Error("Adapter is stopped and cannot subscribe.");
        }

        listener(actor.getSnapshot()); // Notify listeners

        subscription = actor.subscribe((state) => {
          listener(state);
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
            "[XStateAdapter] Cannot send events when adapter is stopped."
          );
          return;
        }
        actor.send(event);
        lastKnownState = actor.getSnapshot(); // Update the last known state
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        if (isStopped) {
          return lastKnownState; // Return the cached state after stop
        }
        return actor.getSnapshot();
      },
      /**
       * Stop the adapter
       */
      stop() {
        cleanupSubscribe();
        actor.stop();
        isStopped = true;
      },
    };
  };
}
