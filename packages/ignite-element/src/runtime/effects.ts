import type { IgniteAdapter } from "@ignite-element/core";
import type {
	EffectSelector,
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	FacadeEffectsObjectCallback,
} from "../RenderArgs";

export const facadeCleanupSymbol = Symbol("ignite.facade.cleanup");

export type FacadeLifecycle = {
	[facadeCleanupSymbol]?: () => void;
};

type AttachEffectsOptions<
	State,
	Event,
	Snapshot,
	CommandActor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
> = {
	adapter: IgniteAdapter<State, Event>;
	effects: FacadeEffectsObjectCallback<Snapshot, CommandActor, Events, Host>;
	resolveSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	host: Host;
	emit: EmitFromEvents<Events>;
};

type ErrorHandlingHost = {
	handleError?: (error: unknown) => void;
	onError?: (error: unknown) => void;
};

function createSelect<Snapshot>(
	snapshot: Snapshot,
	prevSnapshot: Snapshot,
): EffectSelector<Snapshot> {
	return <Value>(selector: (value: Snapshot) => Value) => {
		const current = selector(snapshot);
		const previous = selector(prevSnapshot);
		return {
			current,
			previous,
			changed: !Object.is(current, previous),
		};
	};
}

function reportEffectError(host: unknown, error: unknown): void {
	const errorHost = host as ErrorHandlingHost;
	const handler = errorHost.handleError ?? errorHost.onError;
	if (typeof handler === "function") {
		handler.call(host, error);
		return;
	}

	console.error("[igniteCore] Effect callback failed.", error);
}

export function attachEffects<
	State,
	Event,
	Snapshot,
	CommandActor,
	Events extends EventMap = EmptyEventMap,
	Host = unknown,
>({
	adapter,
	effects,
	resolveSnapshot,
	resolveActor,
	host,
	emit,
}: AttachEffectsOptions<State, Event, Snapshot, CommandActor, Events, Host>) {
	let prevSnapshot = resolveSnapshot(adapter);
	let seeded = false;

	const subscription = adapter.subscribeSnapshots(() => {
		const snapshot = resolveSnapshot(adapter);

		// Adapters seed subscribers with the current snapshot immediately.
		// Treat that first notification as the replay baseline rather than a change.
		if (!seeded) {
			seeded = true;
			prevSnapshot = snapshot;
			return;
		}

		const prev = prevSnapshot;
		prevSnapshot = snapshot;

		// Defer effects to run AFTER render (post-render), matching React's useEffect behavior.
		// Render is triggered synchronously by the same adapter notification, so deferring via
		// microtask ensures the DOM is updated before effects execute.
		queueMicrotask(() => {
			try {
				const actor = resolveActor(adapter);
				const select = createSelect(snapshot, prev);
				const result = effects({
					snapshot,
					prevSnapshot: prev,
					actor,
					emit,
					host,
					select,
				});

				if (
					result &&
					typeof (result as PromiseLike<unknown>).then === "function"
				) {
					void Promise.resolve(result).catch((error: unknown) => {
						reportEffectError(host, error);
					});
				}
			} catch (error) {
				reportEffectError(host, error);
			}
		});
	});

	return () => {
		subscription.unsubscribe();
	};
}
