// @vitest-environment node

import { describe, expect, it } from "vitest";
import { expectCloneable, sealHostGlobals } from "../testing/host-seal";
import { createAppShellCore } from "./app-shell.core";

describe("AppShell boots headless", () => {
	it("delivers the first watch once and touches no host globals", async () => {
		const seal = sealHostGlobals();
		const core = createAppShellCore();
		try {
			const deliveries: Array<{ states: unknown; previous: unknown }> = [];
			const watch = core.watch((states, previous) => {
				deliveries.push({ states, previous });
			});
			expect(deliveries).toHaveLength(1);
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(deliveries[0]?.states).toMatchObject({
				state: "closed",
				activeRoute: "",
				returnTo: null,
				canOpenMenu: true,
				canCloseMenu: false,
				showMenu: false,
				showPanel: false,
				showReturn: false,
			});
			expectCloneable(deliveries[0]?.states);
			await core.execute({ command: "setRoute", input: "Inspector" });
			await core.execute({ command: "openMenu" });
			expect(deliveries[0]?.previous).toBeUndefined();
			expect(core.get("states")).toMatchObject({
				state: "open",
				activeRoute: "Inspector",
				isMenuOpen: true,
				canOpenMenu: false,
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
