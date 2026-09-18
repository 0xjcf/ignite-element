import { type IgniteAdapter, StateScope } from "@ignite-element/core";
import type { BindingStore } from "./bindings";
import {
	assertNoCollisions,
	immutableProjection,
	setCommandOwner,
} from "./bindings";
import {
	activateHostEffects,
	type FacadeLifecycle,
	facadeCleanupSymbol,
} from "./effects";
import { createLifetime, type Lifetime, releaseAll } from "./lifetime";

type Projection<State, Event> = {
	createAdapter: () => IgniteAdapter<State, Event>;
	createArgs: (
		adapter: IgniteAdapter<State, Event>,
		host: EventTarget,
	) => object;
	states: (adapter: IgniteAdapter<State, Event>) => Record<string, unknown>;
	delivered: (snapshot: State) => Record<string, unknown>;
	dispose: () => void;
};

/** Render constructs only discardable objects. The core owns committed bindings. */
export function createIndependentBinding<State, Event>(
	owner: Lifetime,
	createProjection: (isSubscribed: () => boolean) => Projection<State, Event>,
): BindingStore {
	owner.assertActive();
	const lifetime = createLifetime();
	const listeners = new Set<() => void>();
	const projection = createProjection(
		() => lifetime.active && listeners.size > 0,
	);
	const adapter = projection.createAdapter();
	adapter.scope = StateScope.Isolated;
	const host = new EventTarget();
	const args = projection.createArgs(adapter, host);
	let committed = false;
	let releaseOwner: (() => void) | undefined;
	let generation = 0;
	const assertActive = () => {
		owner.assertActive();
		lifetime.assertActive();
	};
	setCommandOwner(args, () => {
		assertActive();
		if (!listeners.size)
			throw new Error(
				"[useIgnite] Independent runtime is unmounted or not committed.",
			);
	});
	const snapshotOf = (states: Record<string, unknown>) => {
		assertNoCollisions(states, args);
		return Object.freeze({
			...(immutableProjection(states) as Record<string, unknown>),
			...args,
		});
	};
	let snapshot = snapshotOf(projection.states(adapter));
	const dispose = () => {
		listeners.clear();
		lifetime.dispose(() =>
			releaseAll([
				() => (args as FacadeLifecycle)[facadeCleanupSymbol]?.(),
				projection.dispose,
				() => adapter.stop(),
			]),
		);
	};
	const store: BindingStore = {
		commit: () => store.subscribe(() => {}),
		prepare: assertActive,
		read: () => {
			assertActive();
			return snapshot;
		},
		subscribe(listener) {
			assertActive();
			generation++;
			listeners.add(listener);
			if (!committed) {
				committed = true;
				releaseOwner = owner.own(dispose);
				try {
					const subscription = adapter.subscribeSnapshots((value) => {
						if (!owner.active || !lifetime.active) return;
						snapshot = snapshotOf(projection.delivered(value));
						for (const notify of [...listeners]) {
							if (owner.active && lifetime.active && listeners.has(notify))
								notify();
						}
					});
					lifetime.own(() => subscription.unsubscribe());
					assertActive();
					activateHostEffects(host);
				} catch (error) {
					try {
						releaseOwner();
					} catch (cleanupError) {
						console.error(
							"[useIgnite] Independent activation rollback failed.",
							cleanupError,
						);
					}
					throw error;
				}
			}
			let subscribed = true;
			return () => {
				if (!subscribed) return;
				subscribed = false;
				listeners.delete(listener);
				if (listeners.size) return;
				const releasedGeneration = ++generation;
				// React's synchronous subscription replay reclaims this live runtime. A
				// genuine unmount ends it; retained commands never point at a replacement.
				queueMicrotask(() => {
					if (generation !== releasedGeneration || listeners.size) return;
					try {
						releaseOwner?.();
					} catch (error) {
						console.error("[useIgnite] Independent cleanup failed.", error);
					}
				});
			};
		},
	};
	return store;
}
