// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createEmptyStateCore } from "./empty-state.core";

describe("EmptyState boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createEmptyStateCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "empty",
				title: "",
				message: "",
				actionLabel: null,
				showAction: false,
				canAct: false,
				canActRefusal: "There is no first step.",
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "setTitle", input: "Today is empty" });
			await core.execute({ command: "setMessage", input: "Capacity 0/3." });
			await core.execute({ command: "setActionLabel", input: "Add a thought" });
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(core.get("states")).toMatchObject({
				state: "empty",
				title: "Today is empty",
				showAction: true,
				canAct: true,
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
