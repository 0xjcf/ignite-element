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

export type XStateActorInstance<Machine extends AnyStateMachine> = ReturnType<
	typeof createActor<Machine>
>;

export type XStateSnapshot<Machine extends AnyStateMachine> =
	StateFrom<Machine>;

export type XStateCommandActor<Machine extends AnyStateMachine> = {
	send: (event: EventFrom<Machine>) => void;
	getSnapshot: () => StateFrom<Machine>;
};

export type XStateMachineActor<Machine extends AnyStateMachine> =
	XStateActorInstance<Machine>;

type XStateAdapterFactory<Machine extends AnyStateMachine> =
	(() => IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>) & {
		scope: StateScope;
		resolveStateSnapshot: (
			adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
		) => StateFrom<Machine>;
		resolveCommandActor: (
			adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
		) => XStateCommandActor<Machine>;
	};

type AdapterEntry<Machine extends AnyStateMachine> = {
	adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>;
	snapshot: () => StateFrom<Machine>;
	actor: XStateActorInstance<Machine>;
	commandActor: XStateCommandActor<Machine>;
};

const stoppedSubscribeWarning =
	"[XStateAdapter] Cannot subscribe when adapter is stopped.";
function requireEntry<Machine extends AnyStateMachine>(
	registry: WeakMap<
		IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
		AdapterEntry<Machine>
	>,
	adapter: IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
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
		IgniteAdapter<StateFrom<Machine>, EventFrom<Machine>>,
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
	ownsSource: boolean,
): AdapterEntry<Machine> {
	const listeners = new Set<(state: StateFrom<Machine>) => void>();
	let subscription: Subscription | null = null;
	let isStopped = false;
	let lastKnownSnapshot: StateFrom<Machine> = actor.getSnapshot();
	type InitialSnapshotState = {
		snapshot: StateFrom<Machine>;
		state: StateFrom<Machine>;
	};
	type ProvisionalCallbackState = {
		active: boolean;
		installing: boolean;
		hasBufferedSnapshot: boolean;
		bufferedSnapshot: StateFrom<Machine> | undefined;
	};

	function notify(snapshot: StateFrom<Machine>) {
		const deliveryListeners = Array.from(listeners);
		for (const listener of deliveryListeners) {
			if (listeners.has(listener)) {
				listener(snapshot);
			}
		}
	}

	function cleanupSubscription() {
		const currentSubscription = subscription;
		subscription = null;
		currentSubscription?.unsubscribe();
	}

	function createGuardedSubscription(
		sourceSubscription: Subscription,
		callbackState: ProvisionalCallbackState,
	): Subscription {
		let unsubscribed = false;
		return {
			unsubscribe() {
				if (unsubscribed) {
					return;
				}
				unsubscribed = true;
				callbackState.active = false;
				sourceSubscription.unsubscribe();
			},
		};
	}

	function installSubscription(
		preflightSnapshot: StateFrom<Machine>,
		preflightState: StateFrom<Machine>,
	): InitialSnapshotState {
		const callbackState: ProvisionalCallbackState = {
			active: true,
			installing: true,
			hasBufferedSnapshot: false,
			bufferedSnapshot: undefined,
		};
		let sourceSubscription: Subscription | null = null;
		let subscribeReturned = false;
		try {
			sourceSubscription = actor.subscribe((state) => {
				if (!callbackState.active) {
					return;
				}
				if (callbackState.installing) {
					callbackState.hasBufferedSnapshot = true;
					callbackState.bufferedSnapshot = state;
					return;
				}

				lastKnownSnapshot = state;
				notify(state);
			});
			subscribeReturned = true;
		} finally {
			if (!subscribeReturned) {
				callbackState.active = false;
				callbackState.installing = false;
			}
		}

		if (!sourceSubscription) {
			callbackState.active = false;
			callbackState.installing = false;
			return failInvariant(
				"[XStateAdapter] Actor subscription must return a cleanup handle.",
			);
		}

		const guardedSubscription = createGuardedSubscription(
			sourceSubscription,
			callbackState,
		);
		subscription = guardedSubscription;
		let installationSucceeded = false;
		try {
			let initialSnapshot = preflightSnapshot;
			let initialState = preflightState;
			if (
				callbackState.hasBufferedSnapshot &&
				typeof callbackState.bufferedSnapshot !== "undefined"
			) {
				initialSnapshot = callbackState.bufferedSnapshot;
				initialState = initialSnapshot;
			}
			lastKnownSnapshot = initialSnapshot;
			callbackState.installing = false;
			installationSucceeded = true;
			return { snapshot: initialSnapshot, state: initialState };
		} finally {
			if (!installationSucceeded) {
				callbackState.installing = false;
				if (subscription === guardedSubscription) {
					subscription = null;
				}
				try {
					guardedSubscription.unsubscribe();
				} catch {
					// Preserve the setup failure; the guarded callback is already inert.
				}
			}
		}
	}

	const typedAdapter: IgniteAdapter<
		StateFrom<Machine>,
		EventFrom<Machine>,
		EmittedFrom<Machine>
	> = {
		subscribeSnapshots(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
			}

			const preflightSnapshot = actor.getSnapshot();
			const preflightState = preflightSnapshot;
			const initial = subscription
				? { snapshot: preflightSnapshot, state: preflightState }
				: installSubscription(preflightSnapshot, preflightState);
			lastKnownSnapshot = initial.snapshot;
			listeners.add(listener);
			let setupSucceeded = false;
			try {
				listener(initial.state);
				setupSucceeded = true;
				let unsubscribed = false;
				return {
					unsubscribe: () => {
						if (unsubscribed) {
							return;
						}
						unsubscribed = true;
						listeners.delete(listener);
						if (!listeners.size) {
							cleanupSubscription();
						}
					},
				};
			} finally {
				if (!setupSucceeded) {
					listeners.delete(listener);
					if (!listeners.size) {
						try {
							cleanupSubscription();
						} catch {
							// Preserve the original snapshot or listener failure.
						}
					}
				}
			}
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
			return snapshot;
		},
		stop() {
			if (isStopped) {
				return;
			}

			isStopped = true;
			listeners.clear();
			let firstError: unknown;
			let hasError = false;
			const captureError = (
				stage: "unsubscribe" | "getSnapshot" | "actor.stop",
				error: unknown,
			) => {
				if (!hasError) {
					hasError = true;
					firstError = error;
					return;
				}
				console.error(
					"[XStateAdapter] Stop cleanup failed after an earlier error.",
					{ stage, error },
				);
			};

			try {
				cleanupSubscription();
			} catch (error) {
				captureError("unsubscribe", error);
			}

			try {
				lastKnownSnapshot = actor.getSnapshot();
			} catch (error) {
				captureError("getSnapshot", error);
			}

			// Only stop the actor when ignite created it (isolated machine source).
			// A consumer-owned, already-started actor (shared scope) is not ours to
			// stop — the consumer owns its lifetime.
			if (ownsSource && typeof actor.stop === "function") {
				try {
					actor.stop();
				} catch (error) {
					captureError("actor.stop", error);
				}
			}

			if (hasError) {
				failInvariant(firstError);
			}
		},
		scope,
	};

	// The adapter object carries a typed `subscribeEvents()` for the machine's
	// emitted union; the runtime reads it structurally, so the entry erases
	// Emitted to the 2-arg IgniteAdapter the factory pipeline expects (no
	// generics ripple).
	const adapter = typedAdapter as unknown as IgniteAdapter<
		StateFrom<Machine>,
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
		getSnapshot: () => adapter.getSnapshot(),
	};

	return {
		adapter,
		snapshot,
		actor,
		commandActor,
	};
}
