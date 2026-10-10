/** @jsxImportSource ignite-element/jsx */
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore } from "../../actor-web/web";
import { jsx } from "../../renderers/jsx/jsx-runtime";

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

const plain = igniteCore({
	source: () => shipmentSource,
});

const speaker = {
	mount() {},
	dispose() {},
};

const radio = igniteCore({
	source: () => shipmentSource,
	hosts: { speaker },
});

web("orbit", (orbitView) => {
	// @ts-expect-error a different host map is not this core's handle
	radio("radio", () => jsx("canvas", { use: orbitView.hosts.scene }));
	// @ts-expect-error a hosted handle is not valid on a core with no hosts
	plain("plain", () => jsx("canvas", { use: orbitView.hosts.scene }));
	// Tag syntax drops `use`, so neither of these is a type error.
	radio("radio", () => <canvas use={orbitView.hosts.scene} />);
	plain("plain", () => <canvas use={orbitView.hosts.scene} />);
	// @ts-expect-error a string cast cannot forge this core's handle
	const cast = "scene" as typeof orbitView.hosts.scene;
	void cast;
	return <canvas use={orbitView.hosts.scene} />;
});

export const hostedWeb = web;
