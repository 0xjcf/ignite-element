// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
	assertFlagReasons,
	assertGalleryCoversStates,
} from "../testing/contract-check";
import { expectCloneable } from "../testing/host-seal";
import { noticeContract } from "./notice.contract";
import { createNoticeCore } from "./notice.core";
import { type NoticeFixtureInput, noticeGallery } from "./notice.gallery";

async function show(input: NoticeFixtureInput) {
	const core = createNoticeCore();
	core.watch(() => {});
	await core.execute({ command: "setTone", input: input.tone });
	await core.execute({ command: "setMessage", input: input.message });
	await core.execute({
		command: "setActions",
		input: input.actions.join("\n"),
	});
	await core.execute({
		command: "setDismissible",
		input: input.dismissible ? "true" : "false",
	});
	if (input.dismissed) await core.execute({ command: "dismiss" });
	return core;
}

describe("Notice states", () => {
	it("covers every declared state and consumer preset", async () => {
		assertGalleryCoversStates(noticeContract, noticeGallery);
		expect(noticeContract.slots).toEqual([]);
		for (const app of ["DevTools", "Twilight", "Booster Budget"] as const) {
			expect(noticeGallery.some((fixture) => fixture.app === app)).toBe(true);
		}
		for (const fixture of noticeGallery) {
			const core = await show(fixture.input);
			try {
				const states = core.get("states");
				expect(states.state).toBe(fixture.state);
				expect(states.tone).toBe(fixture.input.tone);
				expect(states.message).toBe(fixture.input.message);
				expect(states.actions).toEqual([...fixture.input.actions]);
				expect(states.showNotice).toBe(!fixture.input.dismissed);
				assertFlagReasons(states, noticeContract);
				expectCloneable(states);
			} finally {
				core.dispose();
			}
		}
	});

	it("asks the host to recover and does not clear the message", async () => {
		const core = await show({
			tone: "error",
			message: "The event log failed to load.",
			actions: ["Retry"],
			dismissible: false,
			dismissed: false,
		});
		try {
			await core.execute({ command: "recover", input: "Retry" });
			expect(core.get("states")).toMatchObject({
				state: "shown",
				message: "The event log failed to load.",
				recoveryRequested: "Retry",
				isRecoveryRequested: true,
			});
			await core.execute({ command: "dismiss" });
			expect(core.get("states").state).toBe("shown");
		} finally {
			core.dispose();
		}
	});

	it("restores info when the tone attribute is removed", async () => {
		const core = await show({
			tone: "warning",
			message: "Reconnect to the page.",
			actions: [],
			dismissible: false,
			dismissed: false,
		});
		try {
			await core.execute({ command: "setTone", input: null });
			expect(core.get("states").tone).toBe("info");
			await core.execute({ command: "setTone", input: "nope" });
			expect(core.get("states").tone).toBe("info");
			await core.execute({ command: "setTone", input: "error" });
			await core.execute({ command: "setTone", input: "later" });
			expect(core.get("states").tone).toBe("error");
		} finally {
			core.dispose();
		}
	});

	it("does not claim a dismissed notice has no recovery action", async () => {
		const core = await show({
			tone: "warning",
			message: "Reconnect to the page.",
			actions: ["Reconnect"],
			dismissible: true,
			dismissed: true,
		});
		try {
			expect(core.get("states")).toMatchObject({
				state: "dismissed",
				actions: ["Reconnect"],
				showActions: false,
				canRecover: false,
				showActionsRefusal: "This notice was dismissed.",
				canRecoverRefusal: "This notice was dismissed.",
			});
		} finally {
			core.dispose();
		}
	});

	it("hides a dismissible notice until the host sends a new message", async () => {
		const core = await show({
			tone: "info",
			message: "Suggestions are unavailable.",
			actions: [],
			dismissible: true,
			dismissed: false,
		});
		try {
			await core.execute({ command: "dismiss" });
			expect(core.get("states")).toMatchObject({
				state: "dismissed",
				showNotice: false,
				isDismissed: true,
				showNoticeRefusal: "This notice was dismissed.",
			});
			await core.execute({
				command: "setMessage",
				input: "Suggestions are back.",
			});
			expect(core.get("states")).toMatchObject({
				state: "shown",
				message: "Suggestions are back.",
				showNotice: true,
			});
		} finally {
			core.dispose();
		}
	});
});
