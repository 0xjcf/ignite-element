import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createActorWebAdapter,
	type ActorWebSource,
	type ActorWebSourceSnapshot,
	type ActorWebTransportStatus,
} from "ignite-adapters/actor-web";
import { StateScope } from "../../IgniteAdapter";

type ShipmentContext = {
	shipmentId: string | null;
	status: "idle" | "created";
};

type ShipmentCommand =
	| { type: "CREATE_SHIPMENT"; shipmentId: string }
	| { type: "RESET_SHIPMENT" };

function createSource(options?: {
	replayOnSubscribe?: boolean;
	replayTransportOnSubscribe?: boolean;
	replayClonedTransportStatus?: boolean;
}): ActorWebSource<ShipmentContext, ShipmentCommand> & {
	emitTransport(status: ActorWebTransportStatus): void;
} {
	const context: ShipmentContext = {
		shipmentId: null,
		status: "idle",
	};
	const transport: ActorWebTransportStatus = {
		state: "connected",
		updatedAt: 1,
	};
	const snapshotListeners = new Set<
		(snapshot: ActorWebSourceSnapshot<ShipmentContext>) => void
	>();
	const transportListeners = new Set<
		(status: ActorWebTransportStatus) => void
	>();

	const source = {
		address: {
			id: "shipment",
			path: "actor://shipment",
		},
		snapshot: () => ({
			address: source.address,
			context,
			phase: context.status,
			toJSON: () => ({ context }),
		}),
		subscribe: (
			listener: (snapshot: ActorWebSourceSnapshot<ShipmentContext>) => void,
		) => {
			snapshotListeners.add(listener);
			if (options?.replayOnSubscribe) {
				listener(source.snapshot());
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
		emitTransport(status: ActorWebTransportStatus) {
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
});
