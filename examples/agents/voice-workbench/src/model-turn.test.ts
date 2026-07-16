import { describe, expect, it } from "vitest";
import {
	createModelTurnActor,
	MODEL_TURN_ROUND_LIMIT,
	type ModelTurnTerminalEvent,
	projectModelTurnLifecycle,
	projectModelTurnPortRequest,
	projectModelTurnTerminalFact,
} from "./model-turn";

const prompt = {
	channel: "text",
	text: "Create a release checklist.",
} as const;

const feedback = (attemptId: string) => ({
	id: "complete",
	command: "completeResponse",
	status: "accepted" as const,
	view: { status: "responding" },
	events: [{ type: "response-completed" }],
	attemptId,
});

describe("model-turn lifecycle machine", () => {
	it("correlates every async result and emits exactly one successful terminal", () => {
		const actor = createModelTurnActor({ turnId: "turn-1", prompt });
		actor.start();

		expect(actor.getSnapshot()).toMatchObject({
			value: "requesting",
			context: { turnId: "turn-1", round: 1, attemptId: "turn-1:1" },
		});
		expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();
		expect(projectModelTurnLifecycle(actor.getSnapshot())).toMatchObject({
			state: "requesting",
			turnId: "turn-1",
			attemptId: "turn-1:1",
		});
		expect(projectModelTurnPortRequest(actor.getSnapshot())).toMatchObject({
			type: "request-model",
			turnId: "turn-1",
			attemptId: "turn-1:1",
		});

		actor.send({
			type: "MODEL_RESOLVED",
			turnId: "stale-turn",
			attemptId: "turn-1:1",
			result: { ok: true, calls: [] },
		});
		expect(actor.getSnapshot().value).toBe("requesting");

		actor.send({
			type: "MODEL_RESOLVED",
			turnId: "turn-1",
			attemptId: "turn-1:1",
			result: {
				ok: true,
				calls: [
					{
						id: "complete",
						command: "completeResponse",
						input: { text: "Checklist created." },
					},
				],
			},
		});
		expect(actor.getSnapshot()).toMatchObject({
			value: "authorizing",
			context: {
				pendingCall: { id: "complete", command: "completeResponse" },
			},
		});

		actor.send({
			type: "AUTHORIZATION_RESOLVED",
			turnId: "turn-1",
			attemptId: "turn-1:1",
			allowed: true,
		});
		expect(actor.getSnapshot().value).toBe("executing");

		actor.send({
			type: "CAPABILITY_RESOLVED",
			turnId: "turn-1",
			attemptId: "turn-1:1",
			feedback: feedback("turn-1:1"),
		});
		expect(actor.getSnapshot()).toMatchObject({
			value: "completed",
			context: {
				terminal: { type: "TURN_COMPLETED", turnId: "turn-1" },
			},
		});

		const terminal = actor.getSnapshot().context.terminal;
		expect(projectModelTurnTerminalFact(actor.getSnapshot())).toBe(terminal);
		actor.send({ type: "CANCEL", turnId: "turn-1" });
		actor.send({ type: "TIMEOUT", turnId: "turn-1" });
		expect(actor.getSnapshot().context.terminal).toBe(terminal);
		actor.stop();
	});

	it("bounds incomplete rounds and terminates with ROUND_LIMIT_REACHED", () => {
		const actor = createModelTurnActor({ turnId: "turn-limit", prompt });
		actor.start();

		for (let round = 1; round <= MODEL_TURN_ROUND_LIMIT; round += 1) {
			const attemptId = `turn-limit:${round}`;
			expect(actor.getSnapshot().context.attemptId).toBe(attemptId);
			actor.send({
				type: "MODEL_RESOLVED",
				turnId: "turn-limit",
				attemptId,
				result: { ok: true, calls: [] },
			});
		}

		expect(MODEL_TURN_ROUND_LIMIT).toBe(6);
		expect(actor.getSnapshot()).toMatchObject({
			value: "exhausted",
			context: {
				round: 6,
				terminal: {
					type: "ROUND_LIMIT_REACHED",
					turnId: "turn-limit",
				},
			},
		});
		actor.stop();
	});

	it.each([
		["CANCEL", "cancelled", { type: "CANCELLED", turnId: "turn-terminal" }],
		["TIMEOUT", "timed-out", { type: "TIMEOUT", turnId: "turn-terminal" }],
	] as const)(
		"maps %s to one correlated terminal fact",
		(event, state, terminal) => {
			const actor = createModelTurnActor({ turnId: "turn-terminal", prompt });
			actor.start();
			actor.send({ type: event, turnId: "other-turn" });
			expect(actor.getSnapshot().value).toBe("requesting");
			actor.send({ type: event, turnId: "turn-terminal" });
			expect(actor.getSnapshot()).toMatchObject({
				value: state,
				context: { terminal: terminal satisfies ModelTurnTerminalEvent },
			});
			actor.stop();
		},
	);

	it("turns model failure into TURN_FAILED without fabricating completion", () => {
		const actor = createModelTurnActor({ turnId: "turn-failed", prompt });
		actor.start();
		actor.send({
			type: "MODEL_RESOLVED",
			turnId: "turn-failed",
			attemptId: "turn-failed:1",
			result: {
				ok: false,
				error: { kind: "network", message: "private endpoint" },
			},
		});

		expect(actor.getSnapshot()).toMatchObject({
			value: "failed",
			context: {
				terminal: {
					type: "TURN_FAILED",
					turnId: "turn-failed",
					failure: { kind: "network" },
				},
			},
		});
		actor.stop();
	});
});
