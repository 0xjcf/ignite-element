// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
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
import {
	type StatusPillContext,
	statusPillMachine,
} from "./status-pill.source";

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
		const commands = statusPillProjection.commands({
			source: {
				send: (event) => {
					sent.push(event);
				},
			},
		});
		commands.setValue("Saved");
		commands.setValue(null);
		commands.setTone(null);
		commands.setReason(null);
		commands.setAnnounce("false");
		commands.setAnnounce(null);
		expect(sent).toEqual([
			{ type: "SET_VALUE", value: "Saved" },
			{ type: "SET_VALUE", value: "" },
			{ type: "SET_TONE", tone: "neutral" },
			{ type: "SET_REASON", reason: null },
			{ type: "SET_ANNOUNCE", announce: false },
			{ type: "SET_ANNOUNCE", announce: false },
		]);
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

	it("announces on change only after the host opts in", async () => {
		const core = createStatusPillCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "setValue", input: "Paused" });
			await core.execute({ command: "setTone", input: "warning" });
			await core.execute({
				command: "setReason",
				input: "Inspection is paused.",
			});
			expect(core.get("states")).toMatchObject({
				announce: false,
				announcement: null,
				toneLabel: "Warning",
				accessibleName: "Warning Paused — Inspection is paused.",
				a11y: {
					cli: "warning: Paused — Inspection is paused.",
					mcp: { tone: "warning", label: "Warning", status: "quiet" },
				},
			});
			await core.execute({ command: "setAnnounce", input: "true" });
			expect(core.get("states").announcement).toBeNull();
			await core.execute({ command: "setValue", input: "Live" });
			expect(core.get("states")).toMatchObject({
				announcement: "Warning Live — Inspection is paused.",
				a11y: {
					cli: "warning: Live — Inspection is paused.",
					mcp: { status: "polite", value: "Live" },
				},
			});
			await core.execute({ command: "setTone", input: "danger" });
			expect(core.get("states").announcement).toBe(
				"Danger Live — Inspection is paused.",
			);
			await core.execute({ command: "setReason", input: "Needs a look." });
			expect(core.get("states").announcement).toBe(
				"Danger Live — Needs a look.",
			);
			await core.execute({ command: "setAnnounce", input: "false" });
			expect(core.get("states")).toMatchObject({
				announce: false,
				announcement: null,
				a11y: { mcp: { status: "quiet" } },
			});
		} finally {
			core.dispose();
		}
	});

	it("leaves context alone when an action sees the wrong event", () => {
		const actor = createActor(statusPillMachine, {
			input: {
				value: "Saved",
				tone: "success",
				reason: "Done.",
				announce: true,
			},
		});
		actor.start();
		try {
			const context = actor.getSnapshot().context;
			for (const name of [
				"applyValue",
				"applyTone",
				"applyReason",
				"applyAnnounce",
			] as const) {
				const action = statusPillMachine.implementations.actions[name] as {
					assignment: (args: {
						context: StatusPillContext;
						event: { type: string };
					}) => Record<string, unknown>;
				};
				expect(
					action.assignment({
						context,
						event: { type: "NOT_THIS" },
					}),
				).toEqual({});
			}
		} finally {
			actor.stop();
		}
	});

	it("records CLI and MCP equivalents and ships no host", () => {
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
		expect(statusPillContract.a11y?.map((row) => row.cli)).toEqual([
			"Plain status line on stderr. No spinner. Honour NO_COLOR.",
			"Leading tone word (warning:, error:).",
			"Instance id in the output.",
		]);
		expect(statusPillContract.a11y?.map((row) => row.mcp)[0]).toBe(
			"status {value, tone, reason}.",
		);
	});
});
