import type IgniteAdapter from "../IgniteAdapter";
import type {
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	FacadeEffectsCallback,
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
	effects: FacadeEffectsCallback<Snapshot, CommandActor, Events, Host>;
	resolveSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	host: Host;
	emit: EmitFromEvents<Events>;
};

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

	const subscription = adapter.subscribe(() => {
		const snapshot = resolveSnapshot(adapter);

		// Adapters seed subscribers with the current snapshot immediately.
		// Treat that first notification as the replay baseline rather than a change.
		if (!seeded) {
			seeded = true;
			prevSnapshot = snapshot;
			return;
		}

		effects(snapshot, prevSnapshot, {
			actor: resolveActor(adapter),
			emit,
			host,
		});
		prevSnapshot = snapshot;
	});

	return () => {
		subscription.unsubscribe();
	};
}
