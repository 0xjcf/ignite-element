// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createNoticeCore } from "./notice.core";

describe("Notice boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createNoticeCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "shown",
				tone: "info",
				message: "",
				actions: [],
				showNotice: true,
				canDismiss: false,
				canDismissRefusal: "This notice stays until the host clears it.",
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({
				command: "setMessage",
				input: "Reconnect to the page.",
			});
			await core.execute({ command: "setTone", input: "warning" });
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(core.get("states")).toMatchObject({
				state: "shown",
				tone: "warning",
				message: "Reconnect to the page.",
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
