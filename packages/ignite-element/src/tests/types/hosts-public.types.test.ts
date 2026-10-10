import { describe, expect, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore as actorCore } from "../../actor-web";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { igniteCore as xstateCore } from "../../xstate";

const machine = createMachine({
	types: { context: {} as { angle: number } },
	context: { angle: 1 },
});

const scene = {
	mount() {},
	dispose() {},
	select: (snapshot: StateFrom<typeof machine>) => snapshot.context.angle,
	describe: (slice: number) => `angle ${slice}`,
};

const headless = {
	mount() {},
	dispose() {},
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
	core("orbit", ({ hosts }) => jsx("canvas", { use: hosts.scene }));
	// @ts-expect-error use must be a handle on this core
	core("orbit", ({ hosts }) => jsx("canvas", { use: hosts.missing }));
	// @ts-expect-error a bare string is not this core's handle
	core("orbit", () => jsx("canvas", { use: "scene" }));

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
		hosts: { scene: headless },
	});
	actor("orbit", ({ hosts }) => jsx("canvas", { use: hosts.scene }));
	// @ts-expect-error use must be a handle on this actor-web core
	actor("orbit", ({ hosts }) => jsx("canvas", { use: hosts.missing }));
	// @ts-expect-error a bare string is not this core's handle
	actor("orbit", () => jsx("canvas", { use: "scene" }));
}

describe("public host contracts", () => {
	it("is enforced by the test typecheck project", () => {
		expect(hostContracts).toEqual(expect.any(Function));
	});
});
