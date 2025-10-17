import type {
	AnyStateMachine,
	EventFrom,
	StateFrom,
	Subscription,
} from "xstate";
import { createActor } from "xstate";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import { isXStateActor } from "../utils/adapterGuards";

export type ExtendedState<Machine extends AnyStateMachine> =
	StateFrom<Machine> &
		StateFrom<Machine>["context"] & {
			context: StateFrom<Machine>["context"];
		};

export type XStateActorInstance<Machine extends AnyStateMachine> = ReturnType<
	typeof createActor<Machine>
>;

type AdapterFactory<State, Event> = (() => IgniteAdapter<State, Event>) & {
	scope: StateScope;
};

export default function createXStateAdapter<Machine extends AnyStateMachine>(
	source: Machine | XStateActorInstance<Machine>,
): AdapterFactory<ExtendedState<Machine>, EventFrom<Machine>> {
	const toScopedFactory = <State, Event>(
		initializer: () => IgniteAdapter<State, Event>,
		scope: StateScope,
	): AdapterFactory<State, Event> => {
		const factory = () => initializer();
		return Object.assign(factory, { scope });
	};

	if (isXStateActor(source)) {
		const actor = source as XStateActorInstance<Machine>;
		actor.start();

		return toScopedFactory(
			() => createAdapterFromActor(actor, StateScope.Shared, false),
			StateScope.Shared,
		);
	}

	const machine = source as Machine;
	return toScopedFactory(() => {
		const actor = createActor(machine);
		actor.start();
		return createAdapterFromActor(actor, StateScope.Isolated, true);
	}, StateScope.Isolated);
}

function createAdapterFromActor<Machine extends AnyStateMachine>(
	actor: XStateActorInstance<Machine>,
	scope: StateScope,
	ownsActor: boolean,
): IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>> {
	const listeners = new Set<(state: ExtendedState<Machine>) => void>();
	let subscription: Subscription | null = null;
	let isStopped = false;
	let lastKnownSnapshot = actor.getSnapshot();

	function notify(snapshot: StateFrom<Machine>) {
		const state = toExtendedState(snapshot);
		for (const listener of listeners) {
			listener(state);
		}
	}

	function ensureSubscription() {
		if (subscription) {
			return;
		}
		subscription = actor.subscribe((state) => {
			lastKnownSnapshot = state;
			notify(state);
		});
	}

	function cleanupSubscription() {
		subscription?.unsubscribe();
		subscription = null;
	}

	function toExtendedState(
		snapshot: StateFrom<Machine>,
	): ExtendedState<Machine> {
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

			listeners.add(listener);
			ensureSubscription();

			const snapshot = actor.getSnapshot();
			lastKnownSnapshot = snapshot;
			listener(toExtendedState(snapshot));

			return {
				unsubscribe: () => {
					listeners.delete(listener);
					if (!listeners.size) {
						cleanupSubscription();
					}
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
			if (isStopped) {
				return;
			}

			isStopped = true;
			cleanupSubscription();
			listeners.clear();

			if (ownsActor && typeof actor.stop === "function") {
				actor.stop();
			}

			lastKnownSnapshot = actor.getSnapshot();
		},
		scope,
	};

	return adapter;
}
