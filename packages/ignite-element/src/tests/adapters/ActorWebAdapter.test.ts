import {
	type ActorWebSource,
	type ActorWebSourceSnapshot,
	type ActorWebTransportStatus,
	createActorWebAdapter,
} from "@ignite-element/adapters/actor-web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StateScope } from "../../IgniteAdapter";

type ShipmentContext = {
	shipmentId: string | null;
	status: "idle" | "created";
};

type ShipmentCommand =
	| { type: "CREATE_SHIPMENT"; shipmentId: string }
	| { type: "RESET_SHIPMENT" };

type ShipmentEmitted = { type: "SHIPMENT_CREATED"; shipmentId: string };

function createSource(options?: {
	replayOnSubscribe?: boolean;
	replayTransportOnSubscribe?: boolean;
	replayClonedSnapshotGraph?: boolean;
	replayClonedTransportStatus?: boolean;
}): ActorWebSource<ShipmentContext, ShipmentCommand, ShipmentEmitted> & {
	emitSnapshot(
		nextContext: ShipmentContext,
		options?: {
			mutateInPlace?: boolean;
			cloneGraph?: boolean;
		},
	): void;
	emitTransport(status: ActorWebTransportStatus): void;
	emitEvent(event: ShipmentEmitted): void;
	activeEventListeners(): number;
} {
	let context: ShipmentContext = {
		shipmentId: null,
		status: "idle",
	};
	const address = {
		id: "shipment",
		path: "actor://shipment",
	};
	let transport: ActorWebTransportStatus = {
		state: "connected",
		updatedAt: 1,
	};
	const snapshotListeners = new Set<
		(snapshot: ActorWebSourceSnapshot<ShipmentContext>) => void
	>();
	const transportListeners = new Set<
		(status: ActorWebTransportStatus) => void
	>();
	const eventListeners = new Set<(event: ShipmentEmitted) => void>();
	const cloneSnapshot = (
		snapshot: ActorWebSourceSnapshot<ShipmentContext>,
	): ActorWebSourceSnapshot<ShipmentContext> => ({
		address: { ...snapshot.address },
		context: { ...snapshot.context },
		phase: snapshot.phase,
		toJSON: () => ({
			address: { ...snapshot.address },
			context: { ...snapshot.context },
			phase: snapshot.phase,
		}),
	});
	const createSnapshot = (
		nextContext: ShipmentContext,
	): ActorWebSourceSnapshot<ShipmentContext> => ({
		address,
		context: nextContext,
		phase: nextContext.status,
		toJSON: () => ({
			address,
			context: nextContext,
			phase: nextContext.status,
		}),
	});
	let currentSnapshot = createSnapshot(context);

	const source = {
		address,
		snapshot: () => currentSnapshot,
		subscribe: (
			listener: (snapshot: ActorWebSourceSnapshot<ShipmentContext>) => void,
		) => {
			snapshotListeners.add(listener);
			if (options?.replayOnSubscribe) {
				listener(
					options.replayClonedSnapshotGraph
						? cloneSnapshot(currentSnapshot)
						: currentSnapshot,
				);
			}
			return () => {
				snapshotListeners.delete(listener);
			};
		},
		transportStatus: () => transport,
		subscribeTransportStatus: (
			listener: (status: ActorWebTransportStatus) => void,
		) => {
			transportListeners.add(listener);
			if (options?.replayTransportOnSubscribe) {
				listener(
					options.replayClonedTransportStatus ? { ...transport } : transport,
				);
			}
			return () => {
				transportListeners.delete(listener);
			};
		},
		send: async () => undefined,
		subscribeEvent: (listener: (event: ShipmentEmitted) => void) => {
			eventListeners.add(listener);
			return () => {
				eventListeners.delete(listener);
			};
		},
		emitEvent(event: ShipmentEmitted) {
			for (const listener of eventListeners) {
				listener(event);
			}
		},
		activeEventListeners() {
			return eventListeners.size;
		},
		emitSnapshot(
			nextContext: ShipmentContext,
			emitOptions?: {
				mutateInPlace?: boolean;
				cloneGraph?: boolean;
			},
		) {
			if (emitOptions?.mutateInPlace) {
				context.shipmentId = nextContext.shipmentId;
				context.status = nextContext.status;
				currentSnapshot.phase = context.status;
			} else {
				context = { ...nextContext };
				currentSnapshot = createSnapshot(context);
			}
			for (const listener of snapshotListeners) {
				listener(
					emitOptions?.cloneGraph
						? cloneSnapshot(currentSnapshot)
						: currentSnapshot,
				);
			}
		},
		emitTransport(status: ActorWebTransportStatus) {
			transport = status;
			for (const listener of transportListeners) {
				listener(status);
			}
		},
	};

	return source;
}

describe("ActorWebAdapter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("delivers the current extended state immediately when upstream does not replay", () => {
		const adapterFactory = createActorWebAdapter(createSource());
		const adapter = adapterFactory();
		const listener = vi.fn();

		const subscription = adapter.subscribe(listener);

		expect(adapterFactory.scope).toBe(StateScope.Shared);
		expect(adapter.scope).toBe(StateScope.Shared);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				context: { shipmentId: null, status: "idle" },
				phase: "idle",
				status: "idle",
				transport: expect.objectContaining({ state: "connected" }),
			}),
		);

		subscription.unsubscribe();
		adapter.stop();
	});

	it("dedupes the initial notification when upstream replays synchronously", () => {
		const source = createSource({
			replayOnSubscribe: true,
			replayClonedSnapshotGraph: true,
			replayTransportOnSubscribe: true,
			replayClonedTransportStatus: true,
		});
		const adapterFactory = createActorWebAdapter(source);
		const adapter = adapterFactory();
		const listener = vi.fn();

		const subscription = adapter.subscribe(listener);

		expect(listener).toHaveBeenCalledTimes(1);

		source.emitTransport({
			state: "degraded",
			updatedAt: 2,
			reason: "gateway disconnected",
		});

		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				transport: expect.objectContaining({
					state: "degraded",
					reason: "gateway disconnected",
				}),
			}),
		);

		subscription.unsubscribe();
		adapter.stop();
	});

	it("delivers immediately when resubscribing after replaying upstream teardown", () => {
		const source = createSource({
			replayOnSubscribe: true,
			replayClonedSnapshotGraph: true,
			replayTransportOnSubscribe: true,
			replayClonedTransportStatus: true,
		});
		const adapterFactory = createActorWebAdapter(source);
		const adapter = adapterFactory();
		const firstListener = vi.fn();
		const secondListener = vi.fn();

		const firstSubscription = adapter.subscribe(firstListener);
		firstSubscription.unsubscribe();

		const secondSubscription = adapter.subscribe(secondListener);

		expect(firstListener).toHaveBeenCalledTimes(1);
		expect(secondListener).toHaveBeenCalledTimes(1);
		expect(secondListener).toHaveBeenCalledWith(
			expect.objectContaining({
				context: { shipmentId: null, status: "idle" },
				phase: "idle",
				transport: expect.objectContaining({ state: "connected" }),
			}),
		);

		secondSubscription.unsubscribe();
		adapter.stop();
	});

	it("delivers immediately when resubscribing after non-replaying upstream teardown", () => {
		const adapterFactory = createActorWebAdapter(createSource());
		const adapter = adapterFactory();
		const firstListener = vi.fn();
		const secondListener = vi.fn();

		const firstSubscription = adapter.subscribe(firstListener);
		firstSubscription.unsubscribe();

		const secondSubscription = adapter.subscribe(secondListener);

		expect(firstListener).toHaveBeenCalledTimes(1);
		expect(secondListener).toHaveBeenCalledTimes(1);
		expect(secondListener).toHaveBeenCalledWith(
			expect.objectContaining({
				context: { shipmentId: null, status: "idle" },
				phase: "idle",
				transport: expect.objectContaining({ state: "connected" }),
			}),
		);

		secondSubscription.unsubscribe();
		adapter.stop();
	});

	it("notifies for in-place snapshot mutations even when the source reuses object references", () => {
		const source = createSource();
		const adapterFactory = createActorWebAdapter(source);
		const adapter = adapterFactory();
		const listener = vi.fn();

		const subscription = adapter.subscribe(listener);

		source.emitSnapshot(
			{
				shipmentId: "shipment-123",
				status: "created",
			},
			{ mutateInPlace: true },
		);

		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				context: {
					shipmentId: "shipment-123",
					status: "created",
				},
				phase: "created",
				shipmentId: "shipment-123",
				status: "created",
			}),
		);

		subscription.unsubscribe();
		adapter.stop();
	});
});

describe("ActorWebAdapter stream() emitted-event seam", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("bridges source.subscribeEvent emits into stream() and cleans up on unsubscribe", () => {
		const source = createSource();
		const adapter = createActorWebAdapter(source)();
		const received: ShipmentEmitted[] = [];

		const subscription = adapter.stream?.((event) => {
			received.push(event as ShipmentEmitted);
		});

		expect(source.activeEventListeners()).toBe(1);
		source.emitEvent({ type: "SHIPMENT_CREATED", shipmentId: "shipment-1" });
		expect(received).toEqual([
			{ type: "SHIPMENT_CREATED", shipmentId: "shipment-1" },
		]);

		subscription?.unsubscribe();
		// The bare unsubscribe returned by subscribeEvent is invoked — no leak.
		expect(source.activeEventListeners()).toBe(0);
		source.emitEvent({ type: "SHIPMENT_CREATED", shipmentId: "shipment-2" });
		expect(received).toHaveLength(1);

		adapter.stop();
	});

	it("no-ops stream() when the source does not expose subscribeEvent", () => {
		const source = createSource();
		// Model a source that cannot emit by dropping the optional event seam.
		const { subscribeEvent: _subscribeEvent, ...readModelSource } = source;
		const adapter = createActorWebAdapter(
			readModelSource as unknown as ActorWebSource<
				ShipmentContext,
				ShipmentCommand,
				ShipmentEmitted
			>,
		)();

		const subscription = adapter.stream?.(() => {
			throw new Error("listener should not be called");
		});

		expect(() => subscription?.unsubscribe()).not.toThrow();
		adapter.stop();
	});
});
