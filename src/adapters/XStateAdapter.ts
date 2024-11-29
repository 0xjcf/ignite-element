import { AnyStateMachine, StateFrom, EventFrom, createActor } from "xstate";
import IgniteAdapter from "../IgniteAdapter";

export default function createXStateAdapter<Machine extends AnyStateMachine>(
  machine: Machine
): () => IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>> {
  return () => {
    const actor = createActor(machine);
    actor.start();
    let subscription: { unsubscribe: () => void } | null = null;

    function cleanupSubscribe() {
      subscription?.unsubscribe();
      subscription = null;
    }

    return {
      /**
       * Subscribe to state changes
       */
      subscribe(listener) {
        subscription = actor.subscribe((state) => {
          listener(state);
        });
        return {
          unsubscribe: cleanupSubscribe,
        };
      },
      /**
       * Dispatch an action (send an event)
       */
      send(event) {
        actor.send(event);
      },
      /**
       * Get the current state snapshot
       */
      getState() {
        return actor.getSnapshot();
      },
      /**
       * Stop the adapter
       */
      stop() {
        cleanupSubscribe();
        actor.stop();
      },
    };
  };
}
