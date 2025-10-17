import { autorun } from "mobx";
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

type MobxAdapterFactory<State> = (() => IgniteAdapter<State, { type: FunctionKeys<State> }>) & {
    scope: StateScope;
};

export default function createMobXAdapter<State extends object>(
	source: (() => State) | State,
): MobxAdapterFactory<State> {
	const buildAdapter = (
		store: State,
		scope: StateScope,
	): IgniteAdapter<State, { type: FunctionKeys<State> }> => {
		let unsubscribe: (() => void) | null = null;
		let isStopped = false;
		let lastKnownState: State = { ...store };

		function cleanupAutorun() {
			unsubscribe?.();
			unsubscribe = null;
		}

		const adapter: IgniteAdapter<State, { type: FunctionKeys<State> }> = {
			subscribe(listener) {
				if (isStopped) {
					throw new Error("Adapter is stopped and cannot subscribe.");
				}

				unsubscribe = autorun(() => {
					listener({ ...store });
				});

				return {
					unsubscribe: () => {
						if (isStopped) return;
						cleanupAutorun();
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
					action.call(store, event);
					lastKnownState = { ...store };
				} else {
					console.warn(
						`[MobxAdapter] Unknown event type: ${String(event.type)}`,
					);
				}
			},
			getState() {
				return isStopped ? lastKnownState : { ...store };
			},
			stop() {
				cleanupAutorun();
				isStopped = true;
			},
			scope,
		};

		return adapter;
	};

	if (isMobxObservable(source)) {
	const factory = (() =>
		buildAdapter(source as State, StateScope.Shared)
	) as MobxAdapterFactory<State>;
		factory.scope = StateScope.Shared;
		return factory;
	}

	const storeFactory = source as () => State;
	const factory = (() =>
		buildAdapter(storeFactory(), StateScope.Isolated)
	) as MobxAdapterFactory<State>;
	factory.scope = StateScope.Isolated;
	return factory;
}
