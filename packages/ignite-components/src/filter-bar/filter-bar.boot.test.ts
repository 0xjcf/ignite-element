// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createFilterBarCore } from "./filter-bar.core";

describe("FilterBar boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createFilterBarCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "idle",
				query: "",
				active: [],
				isFiltered: false,
				isFilteredRefusal: "Nothing is filtered.",
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "setFilters", input: "Type" });
			await core.execute({ command: "toggle", input: "Type" });
			expect(core.get("states")).toMatchObject({
				state: "filtered",
				active: ["Type"],
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
