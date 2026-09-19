import { createActor, createMachine } from "xstate";
import { expect, it } from "vitest";

it("toggles in the source without a renderer", () => {
	const toggleMachine = createMachine({
		initial: "off",
		states: {
			off: { on: { TOGGLE: "on" } },
			on: { on: { TOGGLE: "off" } },
		},
	});
	const source = createActor(toggleMachine).start();

	try {
		source.send({ type: "TOGGLE" });
		expect(source.getSnapshot().matches("on")).toBe(true);
		source.send({ type: "TOGGLE" });
		expect(source.getSnapshot().matches("off")).toBe(true);
	} finally {
		source.stop();
	}
});
