// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { filterBarContract } from "./filter-bar.contract";
import { createFilterBarCore, filterBarProjection } from "./filter-bar.core";
import {
	type FilterBarFixtureInput,
	filterBarGallery,
} from "./filter-bar.gallery";
import { filterBarMachine } from "./filter-bar.source";

function names(value: string): string[] {
	return value.split("\n").filter((name) => name.length > 0);
}

async function show(input: FilterBarFixtureInput) {
	const core = createFilterBarCore();
	core.watch(() => {});
	await core.execute({ command: "setLabel", input: input.label });
	await core.execute({ command: "setFilters", input: input.filters });
	await core.execute({ command: "setQuery", input: input.query });
	await core.execute({ command: "setActive", input: input.active });
	return core;
}

describe("FilterBar states", () => {
	it("covers every declared state and both consumers", async () => {
		assertGalleryCoversStates(filterBarContract, filterBarGallery);
		expect(filterBarContract.events).toEqual(["change", "clear"]);
		for (const app of ["DevTools", "Booster Budget"] as const) {
			expect(filterBarGallery.some((fixture) => fixture.app === app)).toBe(
				true,
			);
		}
		for (const fixture of filterBarGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.label).toBe(fixture.input.label);
				expect(states.query).toBe(fixture.input.query);
				expect(states.filters).toEqual(names(fixture.input.filters));
				expect(states.active).toEqual(names(fixture.input.active));
				assertFlagReasons(states, filterBarContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("keeps a spaced query and ignores a filter that is not offered", async () => {
		const core = createFilterBarCore();
		try {
			core.watch(() => {});
			await core.execute({
				command: "setFilters",
				input: " Type \n\nType\n Surface ",
			});
			await core.execute({ command: "setQuery", input: "  rent" });
			await core.execute({ command: "toggle", input: "Missing" });
			expect(core.get("states")).toMatchObject({
				state: "filtered",
				query: "  rent",
				filters: ["Type", "Surface"],
				active: [],
				canClear: true,
			});
			await core.execute({ command: "clear" });
			expect(core.get("states")).toMatchObject({
				state: "idle",
				query: "",
				active: [],
				canClear: false,
				canClearRefusal: "Nothing is filtered.",
			});
		} finally {
			core.dispose();
		}
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		filterBarProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.clear();
		expect(sent).toEqual([{ type: "CLEAR" }]);
	});

	it("normalizes initial filters the same way as setFilters", () => {
		const actor = createActor(filterBarMachine, {
			input: {
				filters: [" Type ", "Type", ""],
				active: [" Type "],
			},
		});
		actor.start();
		try {
			expect(actor.getSnapshot().context.filters).toEqual(["Type"]);
			expect(actor.getSnapshot().context.active).toEqual(["Type"]);
		} finally {
			actor.stop();
		}
	});

	it("records CLI and MCP on the contract and ships no host", () => {
		expect(filterBarContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(filterBarContract.surfaces.cli).toMatch(/filter/);
		expect(filterBarContract.surfaces.mcp).toMatch(/property/);
		expect(filterBarContract.layers.headless).toBe(true);
		expect(filterBarContract.slots).toEqual([]);
	});
});
