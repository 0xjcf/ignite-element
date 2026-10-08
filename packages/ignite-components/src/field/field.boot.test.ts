// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createFieldCore } from "./field.core";

describe("Field boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createFieldCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "clean",
				label: "",
				value: "",
				error: null,
				showError: false,
				isTouched: false,
				isTouchedRefusal: "This field has not been touched.",
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "setLabel", input: "Title" });
			await core.execute({ command: "setValue", input: "  Call Mom  " });
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(core.get("states")).toMatchObject({
				state: "clean",
				label: "Title",
				value: "  Call Mom  ",
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
