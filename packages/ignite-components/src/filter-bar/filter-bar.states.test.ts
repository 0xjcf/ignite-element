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
				warnings: ['Unknown filter "Missing". Valid filters: Type, Surface.'],
			});
			await core.execute({ command: "clear" });
			expect(core.get("states")).toMatchObject({
				state: "idle",
				query: "",
				active: [],
				canClear: false,
				canClearRefusal: "Nothing is filtered.",
				warnings: [],
				a11y: { cli: null, mcp: { warnings: [], status: "quiet" } },
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

	it("emits change when SET_FILTERS drops an active name", async () => {
		const core = createFilterBarCore();
		const changes: Array<{ query: string; active: string[] }> = [];
		core.on("change", (event) => {
			changes.push({ query: event.query, active: event.active });
		});
		try {
			core.watch(() => {});
			await core.execute({ command: "setFilters", input: "Type\nSurface" });
			await core.execute({ command: "setActive", input: "Type\nSurface" });
			changes.length = 0;
			await core.execute({ command: "setFilters", input: "Surface" });
			expect(core.get("states")).toMatchObject({
				filters: ["Surface"],
				active: ["Surface"],
				warnings: ['Unknown filter "Type". Valid filters: Surface.'],
			});
			expect(changes).toEqual([{ query: "", active: ["Surface"] }]);
		} finally {
			core.dispose();
		}
	});

	it("warns when SET_FILTERS drops an unknown filter", async () => {
		const core = createFilterBarCore();
		try {
			core.watch(() => {});
			await core.execute({
				command: "setFilters",
				input: "Type\nSurface",
			});
			await core.execute({ command: "setActive", input: "Type" });
			await core.execute({ command: "setFilters", input: "Surface\nRuntime" });
			expect(core.get("states")).toMatchObject({
				filters: ["Surface", "Runtime"],
				active: [],
				warnings: ['Unknown filter "Type". Valid filters: Surface, Runtime.'],
				a11y: {
					cli: 'warning: Unknown filter "Type". Valid filters: Surface, Runtime.',
					mcp: {
						warnings: [
							'Unknown filter "Type". Valid filters: Surface, Runtime.',
						],
					},
				},
			});
		} finally {
			core.dispose();
		}
	});

	it("records CLI and MCP equivalents and ships no host", () => {
		expect(filterBarContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(filterBarContract.surfaces.cli).toMatch(/filter/);
		expect(filterBarContract.surfaces.mcp).toMatch(/property/);
		expect(filterBarContract.layers.headless).toBe(true);
		expect(filterBarContract.slots).toEqual([]);
		expect(filterBarContract.a11y?.map((row) => row.mcp)).toEqual([
			"Property title and enum titles.",
			"warnings[] naming the dropped filters.",
		]);
	});
});
