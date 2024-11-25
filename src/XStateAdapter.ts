import { AnyStateMachine, StateFrom, EventFrom, createActor } from "xstate";
import { IgniteAdapter } from "./IgniteAdapter";

export function createXStateAdapter<Machine extends AnyStateMachine>(
  machine: Machine
): IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>> {
  const actor = createActor(machine);
  actor.start();
  let subscription: { unsubscribe: () => void } | null = null;

  return {
    subscribe(listener) {
      subscription = actor.subscribe((state) => {
        listener(state);
      });
      return {
        unsubscribe: () => {
          subscription?.unsubscribe();
          subscription = null;
        },
      };
    },
    send(event) {
      actor.send(event);
    },
    getState() {
      return actor.getSnapshot();
    },
    stop() {
      if (subscription) {
        subscription?.unsubscribe();
        subscription = null;
      }
      actor.stop();
    },
  };
}
