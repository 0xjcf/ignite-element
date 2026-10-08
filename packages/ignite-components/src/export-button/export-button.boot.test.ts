// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createExportButtonCore } from "./export-button.core";

describe("ExportButton boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createExportButtonCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "idle",
				label: "Export JSON",
				format: "json",
				canExport: true,
				isPreparing: false,
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "export" });
			expect(core.get("states")).toMatchObject({
				state: "preparing",
				canExport: false,
				canExportRefusal: "This export is already running.",
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
