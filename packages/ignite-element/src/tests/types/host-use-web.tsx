/** @jsxImportSource ignite-element/jsx */
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore } from "../../actor-web/web";

type ShipmentContext = { shipmentId: string };
type ShipmentMessage = { type: "shipment.cancel" };

declare const shipmentSource: ActorWebCommandSource<
	ShipmentContext,
	ShipmentMessage,
	ShipmentMessage
>;

const scene = {
	mount() {},
	dispose() {},
};

const web = igniteCore({
	source: () => shipmentSource,
	hosts: { scene },
});

web("orbit", ({ hosts }) => <canvas use={hosts.scene} />);

// @ts-expect-error use must be a handle on this core
web("orbit", ({ hosts }) => <canvas use={hosts.missing} />);

// @ts-expect-error a bare string is not this core's handle
web("orbit", () => <canvas use="scene" />);

export const hostedWeb = web;
