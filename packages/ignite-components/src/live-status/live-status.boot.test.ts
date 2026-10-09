// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createLiveStatusCore } from "./live-status.core";

describe("LiveStatus boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createLiveStatusCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "quiet",
				message: "",
				busy: false,
				isLive: false,
				isLiveRefusal: "There is nothing to announce.",
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "setPoliteness", input: "polite" });
			await core.execute({ command: "setMessage", input: "Saved" });
			expect(core.get("states").state).toBe("polite");
			expect(seal.touched).toEqual([]);
			watch.unsubscribe();
		} finally {
			core.dispose();
			seal.restore();
		}
	});
});
