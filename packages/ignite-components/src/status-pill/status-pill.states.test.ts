// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { statusPillContract } from "./status-pill.contract";
import { createStatusPillCore, statusPillProjection } from "./status-pill.core";
import {
	type StatusPillFixtureInput,
	statusPillGallery,
} from "./status-pill.gallery";

async function show(input: StatusPillFixtureInput) {
	const core = createStatusPillCore();
	core.watch(() => {});
	await core.execute({ command: "setValue", input: input.value });
	await core.execute({ command: "setTone", input: input.tone });
	await core.execute({ command: "setReason", input: input.reason });
	return core;
}

describe("StatusPill states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(statusPillContract, statusPillGallery);
		expect(
			statusPillGallery.some((fixture) => fixture.app === "DevTools"),
		).toBe(true);
		expect(
			statusPillGallery.some((fixture) => fixture.app === "Twilight"),
		).toBe(true);
		expect(
			statusPillGallery.some((fixture) => fixture.app === "Booster Budget"),
		).toBe(true);

		for (const fixture of statusPillGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.value).toBe(fixture.input.value);
				expect(states.tone).toBe(fixture.input.tone);
				expect(states.reason).toBe(fixture.input.reason);
				assertFlagReasons(states, statusPillContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("keeps an unknown tone from becoming the label", async () => {
		const core = createStatusPillCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "setValue", input: "Saved" });
			await core.execute({ command: "setTone", input: "purple" });
			expect(core.get("states")).toMatchObject({
				state: "plain",
				value: "Saved",
				tone: "neutral",
				showReason: false,
			});
		} finally {
			core.dispose();
		}
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		statusPillProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.setValue("Saved");
		expect(sent).toEqual([{ type: "SET_VALUE", value: "Saved" }]);
	});

	it("treats a whitespace-only reason as no reason", async () => {
		const core = createStatusPillCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "setValue", input: "Paused" });
			await core.execute({ command: "setReason", input: " \n\t " });
			expect(core.get("states")).toMatchObject({
				state: "plain",
				reason: null,
				showReason: false,
				showReasonRefusal: "No reason was given.",
			});
		} finally {
			core.dispose();
		}
	});

	it("clears the reason when the host removes it", async () => {
		const core = await show({
			value: "Paused",
			tone: "warning",
			reason: "Inspection is paused.",
		});
		try {
			expect(core.get("states").showReason).toBe(true);
			await core.execute({ command: "setReason", input: null });
			expect(core.get("states")).toMatchObject({
				state: "plain",
				reason: null,
				showReason: false,
				showReasonRefusal: "No reason was given.",
			});
		} finally {
			core.dispose();
		}
	});

	it("records CLI and MCP on the contract and ships no host", () => {
		expect(statusPillContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(statusPillContract.surfaces.cli).toMatch(/text label/);
		expect(statusPillContract.surfaces.mcp).toMatch(/field/);
		expect(
			statusPillContract.commands.every(
				(command) => command.kind === "configuration",
			),
		).toBe(true);
		expect(statusPillContract.slots).toEqual([]);
		expect(statusPillContract.layers).toEqual({
			tokens: true,
			props: true,
			slots: false,
			headless: true,
		});
	});
});
