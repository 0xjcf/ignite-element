// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { startHeadless } from "../testing/start-headless";
import { liveStatusContract } from "./live-status.contract";
import { createLiveStatusCore, liveStatusProjection } from "./live-status.core";
import {
	type LiveStatusFixtureInput,
	liveStatusGallery,
} from "./live-status.gallery";

async function show(input: LiveStatusFixtureInput) {
	const core = createLiveStatusCore();
	startHeadless(core);
	await core.execute({ command: "setTone", input: input.tone });
	await core.execute({ command: "setReason", input: input.reason });
	await core.execute({ command: "setProgress", input: input.progress });
	if (input.settled) {
		await core.execute({ command: "setSettled", input: input.settled });
	} else if (input.message) {
		await core.execute({ command: "setPoliteness", input: input.politeness });
		await core.execute({ command: "setMessage", input: input.message });
	}
	if (input.busy) await core.execute({ command: "setBusy", input: "true" });
	return core;
}

describe("LiveStatus states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(liveStatusContract, liveStatusGallery);
		expect(liveStatusContract.events).toEqual([]);
		expect(liveStatusContract.slots).toEqual([]);
		for (const app of ["DevTools", "Twilight", "Booster Budget"] as const) {
			expect(liveStatusGallery.some((fixture) => fixture.app === app)).toBe(
				true,
			);
		}
		for (const fixture of liveStatusGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.busy).toBe(fixture.input.busy);
				expect(states.progress).toBe(fixture.input.progress);
				expect(states.settled).toBe(fixture.input.settled);
				assertFlagReasons(states, liveStatusContract);
				expectCloneable(states);
				expect(states.a11y.mcp.instanceId).toBe(states.instanceId);
				expect(states.a11y.cli ?? "").not.toContain(String.fromCharCode(27));
			} finally {
				core.dispose();
			}
		}
	});

	it("announces politely, then assertively, without color codes", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({ command: "setTone", input: "warning" });
			await core.execute({ command: "setPoliteness", input: "polite" });
			await core.execute({ command: "setMessage", input: "Connecting" });
			expect(core.get("states")).toMatchObject({
				state: "polite",
				a11y: { cli: "warning: Connecting" },
			});
			await core.execute({ command: "setTone", input: "error" });
			await core.execute({ command: "setPoliteness", input: "assertive" });
			await core.execute({ command: "setMessage", input: "Could not save." });
			expect(core.get("states")).toMatchObject({
				state: "assertive",
				a11y: {
					cli: "error: Could not save.",
					mcp: { tone: "error", status: "assertive", isError: true },
				},
			});
		} finally {
			core.dispose();
		}
	});

	it("says in progress once and already running on the second busy call", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({
				command: "setMessage",
				input: "Preparing the export.",
			});
			await core.execute({ command: "setBusy", input: "true" });
			expect(core.get("states")).toMatchObject({
				state: "busy",
				message: "Preparing the export.",
				isBusy: true,
				a11y: { cli: "in progress", mcp: { status: "busy" } },
			});
			await core.execute({ command: "setBusy", input: "true" });
			expect(core.get("states")).toMatchObject({
				state: "busy",
				message: "Preparing the export.",
				duplicateBusy: true,
				a11y: { cli: "already running", mcp: { status: "busy" } },
			});
			await core.execute({ command: "setBusy", input: "false" });
			expect(core.get("states")).toMatchObject({
				state: "quiet",
				message: "Preparing the export.",
				busy: false,
				duplicateBusy: false,
			});
		} finally {
			core.dispose();
		}
	});

	it("clears a synthesized in-progress line when work stops", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({ command: "setBusy", input: "true" });
			expect(core.get("states")).toMatchObject({
				state: "busy",
				message: "",
				a11y: { cli: "in progress" },
			});
			await core.execute({ command: "setBusy", input: "false" });
			expect(core.get("states")).toMatchObject({
				state: "quiet",
				message: "",
				busy: false,
				a11y: { cli: null },
			});
		} finally {
			core.dispose();
		}
	});

	it("keeps whitespace quiet and rejects an unknown tone", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({ command: "setTone", input: "warning" });
			await core.execute({ command: "setPoliteness", input: "polite" });
			await core.execute({ command: "setMessage", input: "   " });
			expect(core.get("states")).toMatchObject({
				state: "quiet",
				message: "",
				tone: "warning",
				isLive: false,
				a11y: { cli: null, mcp: { label: "Warning", isError: false } },
			});
			await core.execute({ command: "setTone", input: "urgent" });
			expect(core.get("states").tone).toBe("warning");
		} finally {
			core.dispose();
		}
	});

	it("follows the error tone for isError, not the politeness", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({
				command: "announce",
				input: { message: "Check the date.", politeness: "assertive" },
			});
			expect(core.get("states")).toMatchObject({
				state: "assertive",
				a11y: { mcp: { tone: "neutral", isError: false, status: "assertive" } },
			});
			await core.execute({ command: "setTone", input: "warning" });
			expect(core.get("states").a11y.mcp.isError).toBe(false);
			await core.execute({
				command: "announce",
				input: { message: "Could not save.", politeness: "polite" },
			});
			await core.execute({ command: "setTone", input: "error" });
			expect(core.get("states")).toMatchObject({
				state: "polite",
				a11y: {
					cli: "error: Could not save.",
					mcp: {
						tone: "error",
						label: "Error",
						isError: true,
						status: "polite",
					},
				},
			});
		} finally {
			core.dispose();
		}
	});

	it("updates the message and politeness in one announcement", async () => {
		const core = createLiveStatusCore();
		try {
			const seen: string[] = [];
			core.watch((states) => {
				seen.push(`${states.politeness}|${states.message}|${states.state}`);
			});
			await core.execute({
				command: "announce",
				input: { message: "Connecting", politeness: "polite" },
			});
			expect(seen).toEqual(["off||quiet", "polite|Connecting|polite"]);
		} finally {
			core.dispose();
		}
	});

	it("clears only the settled line when settle is null", async () => {
		const core = createLiveStatusCore();
		try {
			startHeadless(core);
			await core.execute({ command: "setPoliteness", input: "polite" });
			await core.execute({ command: "setMessage", input: "Working" });
			await core.execute({ command: "setBusy", input: "true" });
			await core.execute({ command: "setSettled", input: null });
			expect(core.get("states")).toMatchObject({
				state: "busy",
				busy: true,
				politeness: "polite",
				settled: null,
				message: "Working",
			});
			await core.execute({ command: "setSettled", input: "Exported" });
			expect(core.get("states")).toMatchObject({
				state: "settled",
				busy: false,
				politeness: "polite",
				settled: "Exported",
				a11y: { cli: "Exported" },
			});
		} finally {
			core.dispose();
		}
	});

	it("settles on a visible line and gives each instance its own id", async () => {
		const first = createLiveStatusCore();
		const second = createLiveStatusCore();
		try {
			startHeadless(first);
			startHeadless(second);
			await first.execute({ command: "setSettled", input: "Exported" });
			expect(first.get("states")).toMatchObject({
				state: "settled",
				settled: "Exported",
				showSettled: true,
				busy: false,
				a11y: { cli: "Exported" },
			});
			expect(first.get("states").instanceId).not.toBe(
				second.get("states").instanceId,
			);
		} finally {
			first.dispose();
			second.dispose();
		}
	});

	it("records the CLI and MCP equivalents on the contract", () => {
		expect(liveStatusContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(liveStatusContract.a11y?.map((row) => row.cli)).toEqual([
			"Plain status lines on stderr. No spinner when not a TTY. Honour NO_COLOR.",
			"Leading tone word (warning:, error:).",
			"in progress. A second call says already running.",
			"Instance id in the output.",
		]);
		expect(liveStatusContract.a11y?.map((row) => row.mcp)).toEqual([
			"status {value, tone, reason}; progress notifications for long work.",
			"tone enum plus a human label.",
			'status "busy". The second call is idempotent.',
			"instanceId in the result.",
		]);
	});

	it("accepts the igniteCore commands facade", () => {
		const sent: unknown[] = [];
		liveStatusProjection
			.commands({
				source: {
					send: (event) => {
						sent.push(event);
					},
				},
			})
			.setBusy("true");
		expect(sent).toEqual([{ type: "SET_BUSY", busy: true }]);
	});
});
