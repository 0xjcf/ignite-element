import { createMachine } from "xstate";
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore as actorCore } from "../../actor-web";
import type { Host } from "../../hosts/types";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { igniteCore as xstateCore } from "../../xstate";

const machine = createMachine({
	types: { context: {} as { angle: number } },
	context: { angle: 1 },
});

type OrbitSnapshot = { context: { angle: number } };

const scene: Host<HTMLCanvasElement, number, void, OrbitSnapshot> = {
	mount() {},
	dispose() {},
	select: (snapshot) => snapshot.context.angle,
	describe: (slice) => `angle ${slice}`,
};

type ShipmentContext = { shipmentId: string };
type ShipmentMessage = { type: "shipment.cancel" };
declare const shipmentSource: ActorWebCommandSource<
	ShipmentContext,
	ShipmentMessage,
	ShipmentMessage
>;

function hostContracts() {
	const core = xstateCore({
		source: machine,
		hosts: { scene },
	});
	core("orbit", () => jsx("canvas", { use: "scene" }));
	core("orbit", () =>
		// @ts-expect-error use must name a host on this core
		jsx("canvas", { use: "missing" }),
	);

	xstateCore({
		source: machine,
		hosts: {
			scene: {
				mount() {},
				dispose() {},
				// @ts-expect-error select must read this core's snapshot
				select: (snapshot: { nope: true }) => snapshot.nope,
			},
		},
	});

	const actor = actorCore({
		source: shipmentSource,
		hosts: { scene },
	});
	actor("orbit", () => jsx("canvas", { use: "scene" }));
	actor("orbit", () =>
		// @ts-expect-error use must name a host on this actor-web core
		jsx("canvas", { use: "missing" }),
	);
}

void hostContracts;
