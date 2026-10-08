// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createActionButtonCore } from "./action-button.core";

describe("ActionButton boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createActionButtonCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});

			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "idle",
				canPress: true,
				canPressRefusal: null,
				isPending: false,
				showReason: false,
			});
			expectCloneable(deliveries[0]?.states);

			await core.execute({ command: "press" });
			expect(deliveries.length).toBeGreaterThan(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			for (const delivery of deliveries.slice(1)) {
				expect(delivery.previous).toBeDefined();
			}
			expect(core.get("states")).toMatchObject({
				state: "pending",
				canPress: false,
				isPending: true,
				reason: "This action is already running.",
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
