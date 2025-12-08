import type { IReactionDisposer } from "mobx";
import { autorun, toJS } from "mobx";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import { isMobxObservable } from "../utils/mobxGuards";

export type FunctionKeys<StateType> = {
	[Key in keyof StateType]: StateType[Key] extends (
		...args: infer _Params
	) => infer _Result
		? Key
		: never;
}[keyof StateType];

type MethodArgs<
	State extends object,
	Key extends FunctionKeys<State>,
> = State[Key] extends (...args: infer Params) => infer _Result
	? Params
	: never;

export type MobxEvent<State extends object> = {
	[Key in FunctionKeys<State>]: MethodArgs<State, Key> extends []
		? { type: Key; args?: MethodArgs<State, Key> }
		: { type: Key; args: MethodArgs<State, Key> };
}[FunctionKeys<State>];

type MobxAdapterFactory<State extends object> = (() => IgniteAdapter<
	State,
	MobxEvent<State>
>) & {
	scope: StateScope;
	resolveStateSnapshot: (
		adapter: IgniteAdapter<State, MobxEvent<State>>,
	) => State;
	resolveCommandActor: (
		adapter: IgniteAdapter<State, MobxEvent<State>>,
	) => State;
};

type AdapterEntry<State extends object> = {
	adapter: IgniteAdapter<State, MobxEvent<State>>;
	snapshot: () => State;
	store: State;
};

export default function createMobXAdapter<State extends object>(
	source: (() => State) | State,
): MobxAdapterFactory<State> {
	if (isMobxObservable(source)) {
		const entry = createAdapterEntryFromStore(
			source as State,
			StateScope.Shared,
		);
		return createSharedFactory(entry);
	}

	if (typeof source === "function") {
		return createIsolatedFactory(() => {
			const store = source();
			if (!isMobxObservable(store)) {
				throw new Error(
					"[MobxAdapter] store factory must return a MobX observable.",
				);
			}
			return createAdapterEntryFromStore(store, StateScope.Isolated);
		});
	}

	throw new Error(
		"[MobxAdapter] Unsupported source. Provide a MobX observable or a factory function.",
	);
}

function createSharedFactory<State extends object>(
	entry: AdapterEntry<State>,
): MobxAdapterFactory<State> {
	const factory = (() => entry.adapter) as MobxAdapterFactory<State>;
	factory.scope = StateScope.Shared;
	factory.resolveStateSnapshot = () => entry.snapshot();
	factory.resolveCommandActor = () => entry.store;
	return factory;
}

function createIsolatedFactory<State extends object>(
	createEntry: () => AdapterEntry<State>,
): MobxAdapterFactory<State> {
	const registry = new WeakMap<
		IgniteAdapter<State, MobxEvent<State>>,
		AdapterEntry<State>
	>();

	const factory = (() => {
		const entry = createEntry();
		registry.set(entry.adapter, entry);
		return entry.adapter;
	}) as MobxAdapterFactory<State>;

	factory.scope = StateScope.Isolated;
	factory.resolveStateSnapshot = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[MobxAdapter] Unable to resolve snapshot for facade callbacks.",
			);
		}
		return entry.snapshot();
	};
	factory.resolveCommandActor = (adapter) => {
		const entry = registry.get(adapter);
		if (!entry) {
			throw new Error(
				"[MobxAdapter] Unable to resolve actor for facade callbacks.",
			);
		}
		return entry.store;
	};

	return factory;
}

function createAdapterEntryFromStore<State extends object>(
	store: State,
	scope: StateScope,
): AdapterEntry<State> {
	const listeners = new Set<(state: State) => void>();
	let disposer: IReactionDisposer | null = null;
	let isStopped = false;
	let lastSnapshot: State = cloneState();

	function cloneState(): State {
		return toJS(store) as State;
	}

	function notifyListeners(snapshot: State) {
		for (const listener of listeners) {
			listener(snapshot);
		}
	}

	function ensureAutorun() {
		if (disposer) {
			return;
		}
		disposer = autorun(() => {
			const snapshot = cloneState();
			lastSnapshot = snapshot;
			notifyListeners(snapshot);
		});
	}

	function cleanupAutorun() {
		disposer?.();
		disposer = null;
	}

	const adapter: IgniteAdapter<State, MobxEvent<State>> = {
		subscribe(listener) {
			if (isStopped) {
				throw new Error("Adapter is stopped and cannot subscribe.");
			}

			const wasRunning = disposer !== null;
			listeners.add(listener);
			ensureAutorun();

			if (wasRunning) {
				listener(lastSnapshot);
			}

			return {
				unsubscribe: () => {
					if (isStopped) {
						return;
					}
					listeners.delete(listener);
					if (!listeners.size) {
						cleanupAutorun();
					}
				},
			};
		},
		send(event) {
			if (isStopped) {
				console.warn(
					"[MobxAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}

			const action = store[event.type];
			if (typeof action === "function") {
				if ("args" in event && event.args) {
					action.apply(store, event.args);
				} else if (action.length > 0) {
					// Legacy support: pass the event when the action expects arguments.
					action.call(store, event);
				} else {
					action.call(store);
				}
				lastSnapshot = cloneState();
			} else {
				console.warn(`[MobxAdapter] Unknown event type: ${String(event.type)}`);
			}
		},
		getState() {
			return isStopped ? lastSnapshot : cloneState();
		},
		stop() {
			if (isStopped) {
				return;
			}
			isStopped = true;
			cleanupAutorun();
			listeners.clear();
			lastSnapshot = cloneState();
		},
		scope,
	};

	const snapshot = () => {
		if (!isStopped) {
			lastSnapshot = cloneState();
		}
		return lastSnapshot;
	};

	return {
		adapter,
		snapshot,
		store,
	};
}
