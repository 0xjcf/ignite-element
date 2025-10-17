import type { IReactionDisposer } from "mobx";
import { autorun, toJS } from "mobx";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
import { isMobxObservable } from "../utils/adapterGuards";

export type FunctionKeys<StateType> = {
	[Key in keyof StateType]: StateType[Key] extends (
		...args: unknown[]
	) => unknown
		? Key
		: never;
}[keyof StateType];

type MethodArgs<
	State extends object,
	Key extends FunctionKeys<State>,
> = State[Key] extends (...args: infer Params) => unknown ? Params : never;

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
};

export default function createMobXAdapter<State extends object>(
	source: (() => State) | State,
): MobxAdapterFactory<State> {
	const toScopedFactory = (
		initializer: () => IgniteAdapter<State, MobxEvent<State>>,
		scope: StateScope,
	): MobxAdapterFactory<State> => {
		const factory = () => initializer();
		return Object.assign(factory, { scope });
	};

	const createAdapterFromStore = (
		store: State,
		scope: StateScope,
	): IgniteAdapter<State, MobxEvent<State>> => {
		const listeners = new Set<(state: State) => void>();
		let disposer: IReactionDisposer | null = null;
		let isStopped = false;
		let lastSnapshot: State = toJS(store) as State;

		const cloneState = () => toJS(store) as State;

		const notifyListeners = (snapshot: State) => {
			for (const listener of listeners) {
				listener(snapshot);
			}
		};

		const ensureAutorun = () => {
			if (disposer) {
				return;
			}
			disposer = autorun(() => {
				const snapshot = cloneState();
				lastSnapshot = snapshot;
				notifyListeners(snapshot);
			});
		};

		const cleanupAutorun = () => {
			disposer?.();
			disposer = null;
		};

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
					console.warn(
						`[MobxAdapter] Unknown event type: ${String(event.type)}`,
					);
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

		return adapter;
	};

	if (isMobxObservable(source)) {
		return toScopedFactory(
			() => createAdapterFromStore(source as State, StateScope.Shared),
			StateScope.Shared,
		);
	}

	if (typeof source === "function") {
		return toScopedFactory(() => {
			const store = source();
			if (!isMobxObservable(store)) {
				throw new Error(
					"[MobxAdapter] store factory must return a MobX observable.",
				);
			}
			return createAdapterFromStore(store, StateScope.Isolated);
		}, StateScope.Isolated);
	}

	throw new Error(
		"[MobxAdapter] Unsupported source. Provide a MobX observable or a factory function.",
	);
}
