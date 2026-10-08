// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { appShellContract } from "./app-shell.contract";
import { createAppShellCore } from "./app-shell.core";
import {
	type AppShellFixtureInput,
	appShellGallery,
} from "./app-shell.gallery";

async function show(input: AppShellFixtureInput) {
	const core = createAppShellCore();
	core.watch(() => {});
	await core.execute({ command: "setRoute", input: input.activeRoute });
	await core.execute({ command: "setReturnTo", input: input.returnTo });
	await core.execute({
		command: "setPanel",
		input: input.panelOpen ? "true" : "false",
	});
	if (input.menuOpen) await core.execute({ command: "openMenu" });
	return core;
}

describe("AppShell states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(appShellContract, appShellGallery);
		expect(appShellContract.slots).toEqual(["nav", "main", "panel"]);
		for (const app of ["DevTools", "Twilight", "Booster Budget"] as const) {
			expect(appShellGallery.some((fixture) => fixture.app === app)).toBe(true);
		}
		for (const fixture of appShellGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.activeRoute).toBe(fixture.input.activeRoute);
				expect(states.returnTo).toBe(fixture.input.returnTo);
				expect(states.showPanel).toBe(fixture.input.panelOpen);
				expect(states.isMenuOpen).toBe(fixture.input.menuOpen);
				assertFlagReasons(states, appShellContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("asks the host to return without choosing a route", async () => {
		const core = await show({
			activeRoute: "Today",
			menuOpen: false,
			returnTo: "Capture",
			panelOpen: false,
		});
		try {
			await core.execute({ command: "requestReturn" });
			expect(core.get("states")).toMatchObject({
				activeRoute: "Today",
				returnTo: "Capture",
				returnRequested: true,
				isReturnRequested: true,
			});
			await core.execute({ command: "openMenu" });
			expect(core.get("states").activeRoute).toBe("Today");
		} finally {
			core.dispose();
		}
	});

	it("does not request a return when there is no target", async () => {
		const core = createAppShellCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "requestReturn" });
			expect(core.get("states").isReturnRequested).toBe(false);
			expect(core.get("states").canReturnRefusal).toBe(
				"There is no return target.",
			);
		} finally {
			core.dispose();
		}
	});
});
