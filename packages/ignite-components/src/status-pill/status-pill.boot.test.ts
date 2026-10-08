// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createStatusPillCore } from "./status-pill.core";

describe("StatusPill boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createStatusPillCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});

			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "plain",
				value: "",
				tone: "neutral",
				reason: null,
				showReason: false,
				showReasonRefusal: "No reason was given.",
			});
			expectCloneable(deliveries[0]?.states);

			await core.execute({ command: "setValue", input: "Saved" });
			await core.execute({
				command: "setReason",
				input: "On the saved list.",
			});
			expect(deliveries.length).toBeGreaterThan(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			for (const delivery of deliveries.slice(1)) {
				expect(delivery.previous).toBeDefined();
			}
			expect(core.get("states")).toMatchObject({
				state: "withReason",
				value: "Saved",
				showReason: true,
				showReasonRefusal: null,
			});
			expectCloneable(core.get("states"));
			expect(seal.touched).toEqual([]);
			watch.unsubscribe();
		} finally {
			core.dispose();
			seal.restore();
		}
	});
});
