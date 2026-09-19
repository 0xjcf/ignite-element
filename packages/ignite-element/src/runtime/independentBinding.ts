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
	let attached = false;
	const projection = createProjection(
		() => lifetime.active && attached && listeners.size > 0,
	);
	const adapter = projection.createAdapter();
	adapter.scope = StateScope.Isolated;
	const host = new EventTarget();
	const args = projection.createArgs(adapter, host);
	let activated = false;
	let releaseOwner: (() => void) | undefined;
	let generation = 0;
	const assertActive = () => {
		owner.assertActive();
		lifetime.assertActive();
	};
	const assertAttached = () => {
		assertActive();
		if (!attached)
			throw new Error(
				"[useIgnite] Independent runtime is unmounted or not committed.",
			);
	};
	setCommandOwner(args, () => {
		assertAttached();
		activate();
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
	// Activation may be requested by a descendant layout effect or callback ref,
	// before this hook's own layout effect. Attachment itself performs no I/O.
	const activate = () => {
		if (!activated) {
			activated = true;
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
					releaseOwner?.();
				} catch (cleanupError) {
					console.error(
						"[useIgnite] Independent activation rollback failed.",
						cleanupError,
					);
				}
				throw error;
			}
		}
	};
	const store: BindingStore = {
		attach() {
			assertActive();
			attached = true;
			generation++;
			releaseOwner ??= owner.own(dispose);
			return () => {
				attached = false;
				const detachedGeneration = ++generation;
				// Insertion cleanup distinguishes removal/replacement from Activity's
				// temporary effect disconnection. Defer external teardown out of the
				// insertion phase; this is not a subscription-grace-period heuristic.
				queueMicrotask(() => {
					if (attached || generation !== detachedGeneration) return;
					try {
						releaseOwner?.();
					} catch (error) {
						console.error("[useIgnite] Independent cleanup failed.", error);
					}
				});
			};
		},
		commit: () => store.subscribe(() => {}),
		prepare: assertActive,
		read: () => {
			assertActive();
			return snapshot;
		},
		subscribe(listener) {
			assertAttached();
			listeners.add(listener);
			activate();
			return () => {
				listeners.delete(listener);
			};
		},
	};
	return store;
}
