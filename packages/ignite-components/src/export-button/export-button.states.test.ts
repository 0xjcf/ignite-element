// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
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
import {
	type ExportButtonContext,
	exportButtonMachine,
	FAILED_REASON,
} from "./export-button.source";

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

	it("starts failed when given a reason and clears it after retry", () => {
		const blocked = createActor(exportButtonMachine, {
			input: { reason: "  Export unavailable  " },
		});
		blocked.start();
		try {
			expect(blocked.getSnapshot().value).toBe("failed");
			expect(blocked.getSnapshot().context.reason).toBe("Export unavailable");
		} finally {
			blocked.stop();
		}

		const blank = createActor(exportButtonMachine, {
			input: { reason: "   " },
		});
		blank.start();
		try {
			expect(blank.getSnapshot().value).toBe("idle");
			expect(blank.getSnapshot().context.reason).toBeNull();
		} finally {
			blank.stop();
		}

		const actor = createActor(exportButtonMachine, { input: {} });
		actor.start();
		try {
			actor.send({ type: "EXPORT" });
			actor.send({ type: "FAIL", reason: "Disk full." });
			expect(actor.getSnapshot().context.reason).toBe("Disk full.");
			actor.send({ type: "EXPORT" });
			expect(actor.getSnapshot().value).toBe("preparing");
			expect(actor.getSnapshot().context.reason).toBeNull();
			actor.send({ type: "SUCCEED" });
			expect(actor.getSnapshot().value).toBe("ready");
			expect(actor.getSnapshot().context.reason).toBeNull();
		} finally {
			actor.stop();
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

	it("follows setFormat and reports a second export as already running", async () => {
		const core = createExportButtonCore();
		const formats: string[] = [];
		core.on("export", (event) => {
			formats.push(event.format);
		});
		try {
			core.watch(() => {});
			await core.execute({ command: "setFormat", input: "csv" });
			expect(core.get("states")).toMatchObject({
				state: "idle",
				format: "csv",
				label: "Export CSV",
				buttonLabel: "Export CSV",
			});
			await core.execute({ command: "setLabel", input: "Download" });
			await core.execute({ command: "setFormat", input: "csv" });
			expect(core.get("states").label).toBe("Download");
			await core.execute({ command: "export" });
			expect(core.get("states")).toMatchObject({
				state: "preparing",
				canExport: false,
				a11y: { cli: "in progress", mcp: { status: "busy", isError: false } },
			});
			await core.execute({ command: "export" });
			expect(formats).toEqual(["csv"]);
			expect(core.get("states")).toMatchObject({
				state: "preparing",
				duplicateExport: true,
				statusLine: "in progress",
				pendingLabel: "Preparing…",
				a11y: {
					cli: "already running",
					mcp: { status: "busy", isError: false },
				},
			});
			await core.execute({ command: "fail", input: "Disk full." });
			expect(core.get("states").a11y.cli).toBe("error: Disk full.");
		} finally {
			core.dispose();
		}
	});

	it("leaves context alone when an action sees the wrong event", () => {
		const actor = createActor(exportButtonMachine, {
			input: { label: "Download", format: "csv" },
		});
		actor.start();
		try {
			const context = actor.getSnapshot().context;
			const formatAction = exportButtonMachine.implementations.actions
				.applyFormat as unknown as {
				assignment: (args: {
					context: ExportButtonContext;
					event: { type: string };
				}) => Record<string, unknown>;
			};
			expect(
				formatAction.assignment({
					context,
					event: { type: "NOT_THIS" },
				}),
			).toEqual({});

			const failure = exportButtonMachine.implementations.actions
				.applyFailure as unknown as {
				assignment: {
					reason: (args: { event: { type: string } }) => string;
					statusLine: (args: { event: { type: string } }) => string;
				};
			};
			expect(failure.assignment.reason({ event: { type: "EXPORT" } })).toBe(
				FAILED_REASON,
			);
			expect(failure.assignment.statusLine({ event: { type: "EXPORT" } })).toBe(
				FAILED_REASON,
			);
		} finally {
			actor.stop();
		}
	});

	it("records CLI and MCP equivalents and ships no host", () => {
		expect(exportButtonContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(exportButtonContract.surfaces.cli).toMatch(/file/);
		expect(exportButtonContract.surfaces.mcp).toMatch(/structured/);
		expect(exportButtonContract.slots).toEqual([]);
		expect(exportButtonContract.a11y?.map((row) => row.cli)).toEqual([
			"in progress, then a settled line or an error line. No spinner. Honour NO_COLOR.",
			"Non-zero exit plus a reason line.",
			"in progress. A second call says already running.",
			"The command names the format.",
		]);
	});
});
