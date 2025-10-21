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

type XStateAdapterFactory<Machine extends AnyStateMachine> =
	(() => IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>) & {
		scope: StateScope;
		resolveStateSnapshot: (
			adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		) => StateFrom<Machine>;
		resolveCommandActor: (
			adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		) => XStateActorInstance<Machine>;
	};

type AdapterEntry<Machine extends AnyStateMachine> = {
	adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>;
	snapshot: () => StateFrom<Machine>;
	actor: XStateActorInstance<Machine>;
};

export default function createXStateAdapter<Machine extends AnyStateMachine>(
	source: Machine | XStateActorInstance<Machine>,
): XStateAdapterFactory<Machine> {
	if (isXStateActor(source)) {
		const actor = source as XStateActorInstance<Machine>;
		actor.start();
		const entry = createAdapterEntry(actor, StateScope.Shared, false);
		return createSharedFactory(entry);
	}

	const machine = source as Machine;
	return createIsolatedFactory(() => {
		const actor = createActor(machine);
		actor.start();
		return createAdapterEntry(actor, StateScope.Isolated, true);
	});
}

function createSharedFactory<Machine extends AnyStateMachine>(
	entry: AdapterEntry<Machine>,
): XStateAdapterFactory<Machine> {
	const factory = (() => entry.adapter) as XStateAdapterFactory<Machine>;
	factory.scope = StateScope.Shared;
	factory.resolveStateSnapshot = () => entry.snapshot();
	factory.resolveCommandActor = () => entry.actor;
	return factory;
}

function createIsolatedFactory<Machine extends AnyStateMachine>(
	createEntry: () => AdapterEntry<Machine>,
): XStateAdapterFactory<Machine> {
	const registry = new WeakMap<
		IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		AdapterEntry<Machine>
	>();

	const factory = (() => {
		const entry = createEntry();
		registry.set(entry.adapter, entry);
		return entry.adapter;
	}) as XStateAdapterFactory<Machine>;

	factory.scope = StateScope.Isolated;
	factory.resolveStateSnapshot = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[XStateAdapter] Unable to resolve snapshot for facade callbacks.",
			);
		}
		return entry.snapshot();
	};
	factory.resolveCommandActor = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[XStateAdapter] Unable to resolve actor for facade callbacks.",
			);
		}
		return entry.actor;
	};

	return factory;
}

function createAdapterEntry<Machine extends AnyStateMachine>(
	actor: XStateActorInstance<Machine>,
	scope: StateScope,
	ownsActor: boolean,
): AdapterEntry<Machine> {
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
			if (!isStopped) {
				lastKnownSnapshot = snapshot;
			}
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

	const snapshot = () => {
		if (!isStopped) {
			lastKnownSnapshot = actor.getSnapshot();
		}
		return lastKnownSnapshot;
	};

	return {
		adapter,
		snapshot,
		actor,
	};
}
