// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { actionButtonContract } from "./action-button.contract";
import { createActionButtonCore } from "./action-button.core";
import {
	type ActionButtonFixtureInput,
	actionButtonGallery,
} from "./action-button.gallery";
import { actionButtonMachine, PENDING_REASON } from "./action-button.source";

async function show(input: ActionButtonFixtureInput) {
	const core = createActionButtonCore();
	core.watch(() => {});
	await core.execute({ command: "setLabel", input: input.label });
	await core.execute({ command: "setPendingLabel", input: input.pendingLabel });
	if (input.phase === "pending") {
		await core.execute({ command: "press" });
	}
	if (input.phase === "unavailable") {
		await core.execute({ command: "refuse", input: input.reason });
	}
	return core;
}

describe("ActionButton states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(actionButtonContract, actionButtonGallery);
		for (const app of ["DevTools", "Twilight", "Booster Budget"] as const) {
			expect(actionButtonGallery.some((fixture) => fixture.app === app)).toBe(
				true,
			);
		}

		for (const fixture of actionButtonGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.label).toBe(fixture.input.label);
				expect(states.pendingLabel).toBe(fixture.input.pendingLabel);
				if (fixture.state === "pending") {
					expect(states.reason).toBe(PENDING_REASON);
					expect(states.canPress).toBe(false);
				}
				if (fixture.state === "unavailable") {
					expect(states.reason).toBe(fixture.input.reason);
					expect(states.canPress).toBe(false);
				}
				if (fixture.state === "idle") {
					expect(states.canPress).toBe(true);
					expect(states.reason).toBeNull();
				}
				assertFlagReasons(states, actionButtonContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("ignores press while the host says it cannot run", async () => {
		const core = await show({
			label: "Clear",
			pendingLabel: "Clearing…",
			phase: "unavailable",
			reason: "The guard is off.",
		});
		try {
			await core.execute({ command: "press" });
			expect(core.get("states")).toMatchObject({
				state: "unavailable",
				canPress: false,
				canPressRefusal: "The guard is off.",
				isPending: false,
			});
		} finally {
			core.dispose();
		}
	});

	it("keeps a configured initial reason and uses the fallback for blanks", () => {
		const refused = createActor(actionButtonMachine, {
			input: { reason: "Maintenance window." },
		});
		refused.start();
		try {
			expect(refused.getSnapshot().value).toBe("unavailable");
			expect(refused.getSnapshot().context.reason).toBe("Maintenance window.");
		} finally {
			refused.stop();
		}

		const blank = createActor(actionButtonMachine, {
			input: { reason: "   " },
		});
		blank.start();
		try {
			expect(blank.getSnapshot().value).toBe("unavailable");
			expect(blank.getSnapshot().context.reason).toBe(
				"This action is unavailable.",
			);
		} finally {
			blank.stop();
		}

		const open = createActor(actionButtonMachine, { input: {} });
		open.start();
		try {
			expect(open.getSnapshot().value).toBe("idle");
			expect(open.getSnapshot().context.reason).toBeNull();
		} finally {
			open.stop();
		}
	});

	it("uses the visible fallback when refuse is only whitespace", async () => {
		const core = createActionButtonCore();
		try {
			core.watch(() => {});
			await core.execute({ command: "refuse", input: "   " });
			expect(core.get("states")).toMatchObject({
				state: "unavailable",
				reason: "This action is unavailable.",
				showReason: true,
				canPressRefusal: "This action is unavailable.",
			});
		} finally {
			core.dispose();
		}
	});

	it("returns to idle when the host settles or allows", async () => {
		const pending = await show({
			label: "Save",
			pendingLabel: "Saving…",
			phase: "pending",
			reason: null,
		});
		try {
			await pending.execute({ command: "settle" });
			expect(pending.get("states")).toMatchObject({
				state: "idle",
				canPress: true,
				isPending: false,
				showReason: false,
			});
		} finally {
			pending.dispose();
		}

		const blocked = await show({
			label: "Apply",
			pendingLabel: "Applying…",
			phase: "unavailable",
			reason: "Enter an amount first.",
		});
		try {
			await blocked.execute({ command: "allow" });
			expect(blocked.get("states").state).toBe("idle");
			expect(blocked.get("states").canPressRefusal).toBeNull();
		} finally {
			blocked.dispose();
		}
	});

	it("records CLI and MCP on the contract and ships no host", () => {
		expect(actionButtonContract.hosts).toEqual({ cli: "M3", mcp: "M3" });
		expect(actionButtonContract.surfaces.cli).toMatch(/CLI verb/);
		expect(
			actionButtonContract.commands.find((command) => command.name === "press"),
		).toMatchObject({
			kind: "action",
			flag: "canPress",
		});
	});
});
