// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { exportButtonContract } from "./export-button.contract";
import {
	createExportButtonCore,
	exportButtonProjection,
} from "./export-button.core";
import {
	type ExportButtonFixtureInput,
	exportButtonGallery,
} from "./export-button.gallery";

async function show(input: ExportButtonFixtureInput) {
	const core = createExportButtonCore();
	core.watch(() => {});
	await core.execute({ command: "setLabel", input: input.label });
	await core.execute({ command: "setPendingLabel", input: input.pendingLabel });
	await core.execute({ command: "setReadyLabel", input: input.readyLabel });
	await core.execute({ command: "setFormat", input: input.format });
	if (
		input.phase === "preparing" ||
		input.phase === "ready" ||
		input.phase === "failed"
	) {
		await core.execute({ command: "export" });
	}
	if (input.phase === "ready") await core.execute({ command: "succeed" });
	if (input.phase === "failed") {
		await core.execute({ command: "fail", input: input.reason });
	}
	return core;
}

describe("ExportButton states", () => {
	it("covers every declared state and both consumers", async () => {
		assertGalleryCoversStates(exportButtonContract, exportButtonGallery);
		expect(exportButtonContract.events).toEqual(["export"]);
		for (const app of ["DevTools", "Booster Budget"] as const) {
			expect(exportButtonGallery.some((fixture) => fixture.app === app)).toBe(
				true,
			);
		}
		for (const fixture of exportButtonGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.format).toBe("json");
				expect(states.reason).toBe(fixture.input.reason);
				assertFlagReasons(states, exportButtonContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("ignores succeed while idle and keeps a blank failure honest", async () => {
		const core = createExportButtonCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "succeed" });
			expect(core.get("states").state).toBe("idle");
			await core.execute({ command: "export" });
			await core.execute({ command: "fail", input: "  " });
			expect(core.get("states")).toMatchObject({
				state: "failed",
				reason: "The export failed.",
				canExport: true,
				buttonLabel: "Try again",
			});
		} finally {
			core.dispose();
		}
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		exportButtonProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.export();
		expect(sent).toEqual([{ type: "EXPORT" }]);
	});

	it("records CLI and MCP on the contract and ships no host", () => {
		expect(exportButtonContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(exportButtonContract.surfaces.cli).toMatch(/file/);
		expect(exportButtonContract.surfaces.mcp).toMatch(/structured/);
		expect(exportButtonContract.slots).toEqual([]);
	});
});
