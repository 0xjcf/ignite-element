// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { startHeadless } from "../testing/start-headless";
import { tabsContract } from "./tabs.contract";
import { createTabsCore, tabsProjection } from "./tabs.core";
import { type TabsFixtureInput, tabsGallery } from "./tabs.gallery";
import { tabsMachine } from "./tabs.source";

async function show(input: TabsFixtureInput) {
	const core = createTabsCore();
	startHeadless(core);
	await core.execute({ command: "setLabel", input: input.label });
	await core.execute({ command: "setItems", input: input.items });
	await core.execute({ command: "setActive", input: input.active });
	return core;
}

describe("Tabs states", () => {
	it("covers every declared state and both consumers", async () => {
		assertGalleryCoversStates(tabsContract, tabsGallery);
		expect(tabsContract.events).toEqual(["select"]);
		expect(tabsContract.slots).toEqual([]);
		for (const app of ["DevTools", "Booster Budget"] as const) {
			expect(tabsGallery.some((fixture) => fixture.app === app)).toBe(true);
		}
		for (const fixture of tabsGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.label).toBe(fixture.input.label);
				expect(states.items).toEqual(
					fixture.input.items.split("\n").filter((item) => item.length > 0),
				);
				expect(states.active).toBe(fixture.input.active);
				assertFlagReasons(states, tabsContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("drops blank names and ignores a tab that is not in the list", async () => {
		const core = createTabsCore();
		try {
			startHeadless(core);
			await core.execute({
				command: "setItems",
				input: " Gallery \n\nGallery\n Controls ",
			});
			await core.execute({ command: "select", input: "Missing" });
			expect(core.get("states")).toMatchObject({
				state: "open",
				items: ["Gallery", "Controls"],
				active: null,
				isSelected: false,
			});
			await core.execute({ command: "select", input: "Controls" });
			expect(core.get("states")).toMatchObject({
				state: "selected",
				active: "Controls",
			});
			await core.execute({ command: "setItems", input: "Gallery" });
			expect(core.get("states")).toMatchObject({
				state: "open",
				items: ["Gallery"],
				active: null,
				isSelectedRefusal: "No tab is selected.",
			});
		} finally {
			core.dispose();
		}
	});

	it("normalizes initial items the same way as setItems", () => {
		const actor = createActor(tabsMachine, {
			input: {
				items: [" Gallery ", "Gallery", "", "  "],
				active: " Gallery ",
			},
		});
		actor.start();
		try {
			expect(actor.getSnapshot().context.items).toEqual(["Gallery"]);
			expect(actor.getSnapshot().context.active).toBe("Gallery");
			expect(actor.getSnapshot().value).toBe("selected");
		} finally {
			actor.stop();
		}
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		tabsProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.select("Gallery");
		expect(sent).toEqual([{ type: "SELECT", id: "Gallery" }]);
	});

	it("records CLI and MCP as not applicable and ships no host", () => {
		expect(tabsContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(tabsContract.surfaces.cli).toBe("n/a");
		expect(tabsContract.surfaces.mcp).toBe("n/a");
		expect(tabsContract.layers).toEqual({
			tokens: true,
			props: true,
			slots: false,
			headless: true,
		});
	});
});
