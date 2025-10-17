import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { createActor } from "xstate";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import { isXStateActor } from "../utils/adapterGuards";

export type ExtendedState<Machine extends AnyStateMachine> =
	StateFrom<Machine> &
		StateFrom<Machine>["context"] & {
			context: StateFrom<Machine>["context"];
		};

type AdapterFactory<State, Event> = (() => IgniteAdapter<State, Event>) & {
	scope: StateScope;
};

type ActorInstance<Machine extends AnyStateMachine> = ReturnType<
	typeof createActor<Machine>
>;

export default function createXStateAdapter<Machine extends AnyStateMachine>(
	source: Machine | ActorInstance<Machine>,
): AdapterFactory<ExtendedState<Machine>, EventFrom<Machine>> {
	if (isXStateActor(source)) {
		const actor = source as ActorInstance<Machine>;
		actor.start();

		const factory = (() => createAdapterFromActor(actor, StateScope.Shared, false)) as AdapterFactory<
			ExtendedState<Machine>,
			EventFrom<Machine>
		>;
 		factory.scope = StateScope.Shared;
		return factory;
	}

	const machine = source as Machine;
	const factory = (() => {
		const actor = createActor(machine);
		actor.start();
		return createAdapterFromActor(actor, StateScope.Isolated, true);
	}) as AdapterFactory<ExtendedState<Machine>, EventFrom<Machine>>;
	factory.scope = StateScope.Isolated;
	return factory;
}

function createAdapterFromActor<Machine extends AnyStateMachine>(
	actor: ActorInstance<Machine>,
	scope: StateScope,
	ownsActor: boolean,
): IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>> {
	let subscription: { unsubscribe: () => void } | null = null;
	let isStopped = false;
	let lastKnownSnapshot = actor.getSnapshot();

	function cleanupSubscribe() {
		subscription?.unsubscribe();
		subscription = null;
	}

	function toExtendedState(snapshot: StateFrom<Machine>): ExtendedState<Machine> {
		const { context, ...rest } = snapshot as StateFrom<Machine> & {
			context: StateFrom<Machine>["context"];
		};

		return {
			...rest,
			...context,
			context,
		};
	}

	const adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>> = {
		subscribe(listener) {
			if (isStopped) {
				throw new Error("Adapter is stopped and cannot subscribe.");
			}

			listener(this.getState());

			subscription = actor.subscribe((state) => {
				lastKnownSnapshot = state;
				listener(this.getState());
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
					"[XStateAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}
			actor.send(event);
			lastKnownSnapshot = actor.getSnapshot();
		},
		getState() {
			const snapshot = isStopped ? lastKnownSnapshot : actor.getSnapshot();
			return toExtendedState(snapshot);
		},
		stop() {
			cleanupSubscribe();
			if (ownsActor && typeof actor.stop === "function") {
				actor.stop();
			}
			isStopped = true;
		},
		scope,
	};

	return adapter;
}
