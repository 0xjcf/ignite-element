import type { IgniteAdapter } from "@ignite-element/core";
import { failInvariant, StateScope } from "@ignite-element/core";
import type {
	AnyStateMachine,
	EmittedFrom,
	EventFrom,
	StateFrom,
	Subscription,
} from "xstate";
import { createActor } from "xstate";
import { isXStateActor } from "../utils/adapterGuards";

export type ExtendedState<Machine extends AnyStateMachine> =
	StateFrom<Machine> &
		StateFrom<Machine>["context"] & {
			context: StateFrom<Machine>["context"];
		};

export type XStateActorInstance<Machine extends AnyStateMachine> = ReturnType<
	typeof createActor<Machine>
>;

export type XStateSnapshot<Machine extends AnyStateMachine> =
	ExtendedState<Machine>;

export type XStateCommandActor<Machine extends AnyStateMachine> = {
	send: (event: EventFrom<Machine>) => void;
	readonly state: ExtendedState<Machine>;
};

export type XStateMachineActor<Machine extends AnyStateMachine> =
	XStateActorInstance<Machine>;

type XStateAdapterFactory<Machine extends AnyStateMachine> =
	(() => IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>) & {
		scope: StateScope;
		resolveStateSnapshot: (
			adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		) => StateFrom<Machine>;
		resolveCommandActor: (
			adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		) => XStateCommandActor<Machine>;
	};

type AdapterEntry<Machine extends AnyStateMachine> = {
	adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>;
	snapshot: () => StateFrom<Machine>;
	actor: XStateActorInstance<Machine>;
	commandActor: XStateCommandActor<Machine>;
};

const stoppedSubscribeWarning =
	"[XStateAdapter] Cannot subscribe when adapter is stopped.";

function requireEntry<Machine extends AnyStateMachine>(
	registry: WeakMap<
		IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
		AdapterEntry<Machine>
	>,
	adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>,
	errorMessage: string,
): AdapterEntry<Machine> {
	const entry = registry.get(adapter);
	return entry ?? failInvariant(errorMessage);
}

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
	factory.resolveCommandActor = () => entry.commandActor;
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
		return requireEntry(
			registry,
			adapter,
			"[XStateAdapter] Unable to resolve snapshot for facade callbacks.",
		).snapshot();
	};
	factory.resolveCommandActor = (adapter) => {
		return requireEntry(
			registry,
			adapter,
			"[XStateAdapter] Unable to resolve actor for facade callbacks.",
		).commandActor;
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

	const typedAdapter: IgniteAdapter<
		ExtendedState<Machine>,
		EventFrom<Machine>,
		EmittedFrom<Machine>
	> = {
		subscribeSnapshots(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
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
		subscribeEvents(listener) {
			// Bridge the actor's emitted domain events (XState v5 `emit(...)`)
			// into the headless runtime's event surface (on()/execute().events).
			if (isStopped) {
				console.warn(
					"[XStateAdapter] Cannot subscribe to emitted events when adapter is stopped.",
				);
				return { unsubscribe: () => {} };
			}

			const emittedSubscription = actor.on("*", (emitted) => {
				listener(emitted);
			});
			return {
				unsubscribe: () => {
					emittedSubscription.unsubscribe();
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
		getSnapshot() {
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
			lastKnownSnapshot = actor.getSnapshot();

			if (ownsActor && typeof actor.stop === "function") {
				actor.stop();
			}
		},
		scope,
	};

	// The adapter object carries a typed `subscribeEvents()` for the machine's
	// emitted union; the runtime reads it structurally, so the entry erases
	// Emitted to the 2-arg IgniteAdapter the factory pipeline expects (no
	// generics ripple).
	const adapter = typedAdapter as unknown as IgniteAdapter<
		ExtendedState<Machine>,
		EventFrom<Machine>
	>;

	const snapshot = () => {
		if (!isStopped) {
			lastKnownSnapshot = actor.getSnapshot();
		}
		return lastKnownSnapshot;
	};

	const commandActor: XStateCommandActor<Machine> = {
		send: (event: EventFrom<Machine>) => {
			if (isStopped) {
				console.warn(
					"[XStateAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}
			actor.send(event);
			lastKnownSnapshot = actor.getSnapshot();
		},
		get state() {
			return adapter.getSnapshot();
		},
	};

	return {
		adapter,
		snapshot,
		actor,
		commandActor,
	};
}
