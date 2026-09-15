import type { IgniteAdapter } from "@ignite-element/core";
import type {
	EffectSelector,
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	FacadeEffectsObjectCallback,
} from "../RenderArgs";

export const facadeCleanupSymbol = Symbol("ignite.facade.cleanup");

// Readiness registers an inactive recipient. Actual runtime use or a committed
// subscription/connection activates its core/source owner, never a view runner.
const deferredHosts = new WeakMap<
	object,
	{ active: boolean; start?: () => void }
>();
export function registerHostEffects(
	host: object,
	start: () => void,
): () => void {
	const record = { active: false, start };
	deferredHosts.set(host, record);
	return () => {
		if (deferredHosts.get(host) === record) deferredHosts.delete(host);
	};
}
export function activateHostEffects(host: object): void {
	const deferred = deferredHosts.get(host);
	if (!deferred || deferred.active) return;
	deferred.active = true;
	try {
		deferred.start?.();
	} catch (error) {
		deferred.active = false;
		throw error;
	}
}

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
	host: unknown;
	emit: EmitFromEvents<Events>;
	isActive?: () => boolean;
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

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value &&
		typeof (value as { then?: unknown }).then === "function"
	);
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
	host,
	emit,
	isActive = () => true,
}: AttachEffectsOptions<State, Event, Snapshot, CommandActor, Events, Host>) {
	let prevSnapshot = resolveSnapshot(adapter);
	let seeded = false;
	let active = true;

	const listener = () => {
		if (!active || !isActive()) return;
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

		// Ignite renderers update synchronously from the same notification.
		// Headless observers have no renderer commit barrier; this does not wait
		// for a React (or other external framework) commit.
		queueMicrotask(() => {
			if (!active || !isActive()) return;
			try {
				const select = createSelect(snapshot, prev);
				const result = effects({
					snapshot,
					prevSnapshot: prev,
					emit: (event) => {
						if (active && isActive()) emit(event);
					},
					select,
				});

				if (typeof result !== "undefined") {
					if (isPromiseLike(result)) {
						void Promise.resolve(result).catch((error: unknown) => {
							reportEffectError(host, error);
						});
					}

					reportEffectError(
						host,
						new Error(
							"[igniteCore] Effect callbacks must return void. Move async work into the source and emit outward facts from accepted state transitions.",
						),
					);
				}
			} catch (error) {
				reportEffectError(host, error);
			}
		});
	};

	let subscription: ReturnType<typeof adapter.subscribeSnapshots>;
	try {
		subscription = adapter.subscribeSnapshots(listener);
	} catch (error) {
		active = false;
		throw error;
	}

	return () => {
		if (!active) return;
		active = false;
		subscription.unsubscribe();
	};
}
