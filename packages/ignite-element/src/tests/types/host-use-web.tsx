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

// @ts-expect-error a bare string is not this core's handle
web("orbit", () => jsx("canvas", { use: "scene" }));

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

const twin = igniteCore({
	source: () => shipmentSource,
	hosts: { scene },
});

web("orbit", (orbitView) => {
	const { hosts } = orbitView;
	// @ts-expect-error a typo is not a host on this core
	const typo: typeof hosts.scene = hosts.missing;
	// @ts-expect-error a bare string is not this core's handle
	const bare: typeof hosts.scene = "scene";
	// @ts-expect-error a string cast cannot forge this core's handle
	const cast: typeof hosts.scene = "scene" as typeof hosts.scene;
	// @ts-expect-error a typo is not a host on this core
	jsx("canvas", { use: hosts.missing });
	// @ts-expect-error a string cast cannot forge this core's handle
	jsx("canvas", { use: "scene" as typeof hosts.scene });
	void typo;
	void bare;
	void cast;
	// @ts-expect-error a different host map is not this core's handle
	radio("radio", () => jsx("canvas", { use: hosts.scene }));
	// @ts-expect-error a hosted handle is not valid on a core with no hosts
	plain("plain", () => jsx("canvas", { use: hosts.scene }));
	twin("twin", (twinView) => {
		const same: typeof hosts.scene = twinView.hosts.scene;
		void same;
		return jsx("canvas", { use: hosts.scene });
	});
	// On JSX tags, TypeScript cannot reject a handle from another core.
	// Cores with identical host maps are not distinguished.
	radio("radio", () => <canvas use={hosts.scene} />);
	plain("plain", () => <canvas use={hosts.scene} />);
	twin("twin", () => <canvas use={hosts.scene} />);
	return <canvas use={hosts.scene} />;
});

radio("radio", (radioView) => {
	web("orbit", (orbitView) => {
		// @ts-expect-error a different host map is not this core's handle
		const mismatch: typeof orbitView.hosts.scene = radioView.hosts.speaker;
		void mismatch;
		return <canvas use={orbitView.hosts.scene} />;
	});
	return <canvas use={radioView.hosts.speaker} />;
});

export const hostedWeb = web;
