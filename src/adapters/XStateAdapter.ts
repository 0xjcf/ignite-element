import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { createActor } from "xstate";
import type IgniteAdapter from "../IgniteAdapter";

export type ExtendedState<Machine extends AnyStateMachine> =
	StateFrom<Machine> &
		StateFrom<Machine>["context"] & {
			context: StateFrom<Machine>["context"];
		};

export default function createXStateAdapter<Machine extends AnyStateMachine>(
	machine: Machine,
): () => IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>> {
	return () => {
		const actor = createActor(machine);
		actor.start();

		let subscription: { unsubscribe: () => void } | null = null;
		let isStopped = false;
		let lastKnownState: ExtendedState<Machine> = actor.getSnapshot();

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

				listener(this.getState()); // Notify listeners of initial state

				subscription = actor.subscribe((state) => {
					lastKnownState = state;
					listener(this.getState()); // get back extended state
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
						"[XStateAdapter] Cannot send events when adapter is stopped.",
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
				const snapshot = isStopped ? lastKnownState : actor.getSnapshot();
				const { context, ...rest } = snapshot;

				const state = {
					...rest,
					...context,
					context,
				};

				return state;
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
