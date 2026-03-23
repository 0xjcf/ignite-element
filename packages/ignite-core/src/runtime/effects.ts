import type IgniteAdapter from "../IgniteAdapter";
import type {
	EffectSelector,
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	FacadeEffectsCallback,
	FacadeEffectsLike,
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
	effects: FacadeEffectsLike<Snapshot, CommandActor, Events, Host>;
	resolveSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
	host: Host;
	emit: EmitFromEvents<Events>;
};

const objectStyleCallbackPattern =
	/^(?:async\s*)?(?:function\b[^(]*\(\s*\{|\(\s*\{|\{\s*)/;

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

function isObjectStyleEffectsCallback<
	Snapshot,
	CommandActor,
	Events extends EventMap,
	Host,
>(effects: FacadeEffectsLike<Snapshot, CommandActor, Events, Host>): boolean {
	if (effects.length > 1) {
		return false;
	}

	const source = Function.prototype.toString.call(effects).trim();
	return objectStyleCallbackPattern.test(source);
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

	const subscription = adapter.subscribe(() => {
		const snapshot = resolveSnapshot(adapter);

		// Adapters seed subscribers with the current snapshot immediately.
		// Treat that first notification as the replay baseline rather than a change.
		if (!seeded) {
			seeded = true;
			prevSnapshot = snapshot;
			return;
		}

		const actor = resolveActor(adapter);
		const select = createSelect(snapshot, prevSnapshot);

		if (isObjectStyleEffectsCallback(effects)) {
			(
				effects as FacadeEffectsObjectCallback<
					Snapshot,
					CommandActor,
					Events,
					Host
				>
			)({
				snapshot,
				prevSnapshot,
				actor,
				emit,
				host,
				select,
			});
		} else {
			(effects as FacadeEffectsCallback<Snapshot, CommandActor, Events, Host>)(
				snapshot,
				prevSnapshot,
				{
					actor,
					emit,
					host,
					select,
				},
			);
		}
		prevSnapshot = snapshot;
	});

	return () => {
		subscription.unsubscribe();
	};
}
