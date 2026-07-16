import { describe, expect, it } from "vitest";
import {
	createSpeechDeliveryActor,
	projectSpeechDeliveryLifecycle,
	projectSpeechDeliveryPortRequest,
	projectSpeechDeliveryTerminalFact,
} from "./speech";

describe("speech-delivery lifecycle machine", () => {
	it("records speak acceptance as queued and onend as delivered", () => {
		const actor = createSpeechDeliveryActor({
			id: "speech-1",
			text: "Ship the checklist.",
			attemptId: "speech-1:1",
		});
		actor.start();

		expect(actor.getSnapshot()).toMatchObject({
			value: "pending",
			context: { terminal: null },
		});
		expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();
		expect(projectSpeechDeliveryPortRequest(actor.getSnapshot())).toEqual({
			type: "speak",
			id: "speech-1",
			text: "Ship the checklist.",
			attemptId: "speech-1:1",
			sequence: 1,
		});

		actor.send({ type: "QUEUED", attemptId: "stale" });
		expect(actor.getSnapshot().value).toBe("pending");
		actor.send({ type: "QUEUED", attemptId: "speech-1:1" });
		expect(actor.getSnapshot()).toMatchObject({
			value: "queued",
			context: {
				terminal: null,
				fact: { type: "speech-delivery-queued", id: "speech-1" },
			},
		});

		actor.send({ type: "DELIVERED", attemptId: "speech-1:1" });
		expect(actor.getSnapshot()).toMatchObject({
			value: "delivered",
			context: {
				terminal: {
					type: "speech-delivery-completed",
					id: "speech-1",
				},
			},
		});

		const terminal = actor.getSnapshot().context.terminal;
		expect(projectSpeechDeliveryLifecycle(actor.getSnapshot())).toMatchObject({
			state: "delivered",
			text: "Ship the checklist.",
			terminal,
		});
		expect(projectSpeechDeliveryTerminalFact(actor.getSnapshot())).toBe(
			terminal,
		);
		actor.send({ type: "CANCEL", attemptId: "speech-1:1" });
		actor.send({ type: "DISPOSE" });
		expect(actor.getSnapshot().context.terminal).toBe(terminal);
		actor.stop();
	});

	it.each([
		["MUTED", "muted", "speech-delivery-muted"],
		["UNAVAILABLE", "unavailable", "speech-delivery-unavailable"],
		["CANCEL", "cancelled", "speech-delivery-cancelled"],
	] as const)(
		"represents %s as an explicit terminal state",
		(event, state, fact) => {
			const actor = createSpeechDeliveryActor({
				id: "speech-terminal",
				text: "Terminal speech.",
				attemptId: "speech-terminal:1",
			});
			actor.start();
			actor.send({ type: event, attemptId: "speech-terminal:1" });
			expect(actor.getSnapshot()).toMatchObject({
				value: state,
				context: { terminal: { type: fact, id: "speech-terminal" } },
			});
			actor.stop();
		},
	);

	it("makes failure and disposal idempotent", () => {
		const failed = createSpeechDeliveryActor({
			id: "speech-failed",
			text: "Failure speech.",
			attemptId: "speech-failed:1",
		});
		failed.start();
		failed.send({
			type: "FAIL",
			attemptId: "speech-failed:1",
			message: "Audio device failed.",
		});
		expect(failed.getSnapshot()).toMatchObject({
			value: "failed",
			context: {
				terminal: {
					type: "speech-delivery-failed",
					message: "Audio device failed.",
				},
			},
		});
		failed.stop();

		const disposed = createSpeechDeliveryActor({
			id: "speech-disposed",
			text: "Dispose speech.",
			attemptId: "speech-disposed:1",
		});
		disposed.start();
		disposed.send({ type: "DISPOSE" });
		disposed.send({ type: "DISPOSE" });
		expect(disposed.getSnapshot().value).toBe("disposed");
		disposed.stop();
	});
});
