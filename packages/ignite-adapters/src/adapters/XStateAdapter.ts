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
	getSnapshot: () => ExtendedState<Machine>;
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
const invalidSnapshotContextMessage =
	"[XStateAdapter] Snapshot context must be an own data property.";
const unsafeSnapshotInspectionMessage =
	"[XStateAdapter] Unable to inspect snapshot descriptors safely.";

function collectEnumerableDescriptors(
	source: object,
	descriptors: Map<PropertyKey, PropertyDescriptor>,
	omitContext: boolean,
): void {
	for (const key of Reflect.ownKeys(source)) {
		if (omitContext && key === "context") {
			continue;
		}
		const descriptor = Object.getOwnPropertyDescriptor(source, key);
		if (descriptor?.enumerable === true) {
			descriptors.set(key, descriptor);
		}
	}
}

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
	ownsSource: boolean,
): AdapterEntry<Machine> {
	const listeners = new Set<(state: ExtendedState<Machine>) => void>();
	let subscription: Subscription | null = null;
	let isStopped = false;
	let lastKnownSnapshot: StateFrom<Machine> = actor.getSnapshot();
	type InitialSnapshotState = {
		snapshot: StateFrom<Machine>;
		state: ExtendedState<Machine>;
	};
	type ProvisionalCallbackState = {
		active: boolean;
		installing: boolean;
		hasBufferedSnapshot: boolean;
		bufferedSnapshot: StateFrom<Machine> | undefined;
	};

	function notify(snapshot: StateFrom<Machine>) {
		const state = toExtendedState(snapshot);
		for (const listener of listeners) {
			listener(state);
		}
	}

	function cleanupSubscription() {
		const currentSubscription = subscription;
		subscription = null;
		currentSubscription?.unsubscribe();
	}

	function toExtendedState(
		snapshot: StateFrom<Machine>,
	): ExtendedState<Machine> {
		let contextDescriptor: PropertyDescriptor | undefined;
		try {
			contextDescriptor = Object.getOwnPropertyDescriptor(snapshot, "context");
		} catch {
			return failInvariant(unsafeSnapshotInspectionMessage);
		}
		if (!contextDescriptor || !("value" in contextDescriptor)) {
			return failInvariant(invalidSnapshotContextMessage);
		}
		const context: unknown = contextDescriptor.value;
		if (typeof context !== "object" || context === null) {
			return failInvariant(invalidSnapshotContextMessage);
		}

		try {
			const descriptors = new Map<PropertyKey, PropertyDescriptor>();
			collectEnumerableDescriptors(snapshot, descriptors, true);
			collectEnumerableDescriptors(context, descriptors, false);
			descriptors.set("context", {
				value: context,
				enumerable: true,
				writable: true,
				configurable: true,
			});

			const extendedState = Object.create(Object.prototype);
			for (const [key, descriptor] of descriptors) {
				Object.defineProperty(extendedState, key, descriptor);
			}
			return extendedState;
		} catch {
			return failInvariant(unsafeSnapshotInspectionMessage);
		}
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
		preflightState: ExtendedState<Machine>,
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
				initialState = toExtendedState(initialSnapshot);
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
		ExtendedState<Machine>,
		EventFrom<Machine>,
		EmittedFrom<Machine>
	> = {
		subscribeSnapshots(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
			}

			const preflightSnapshot = actor.getSnapshot();
			const preflightState = toExtendedState(preflightSnapshot);
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

			// Only stop the actor when ignite created it (isolated machine source).
			// A consumer-owned, already-started actor (shared scope) is not ours to
			// stop — the consumer owns its lifetime.
			if (ownsSource && typeof actor.stop === "function") {
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
		getSnapshot: () => adapter.getSnapshot(),
	};

	return {
		adapter,
		snapshot,
		actor,
		commandActor,
	};
}
