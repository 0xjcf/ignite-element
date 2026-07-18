import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { getShortestPaths, getSimplePaths } from "xstate/graph";
import {
	createModelTurnActor,
	MODEL_TURN_ROUND_LIMIT,
	type ModelTurnLifecycleEvent,
	type ModelTurnOutput,
	type ModelTurnSnapshot,
	modelTurnMachine,
	modelTurnStateFromTerminal,
	projectModelTurnLifecycle,
	projectModelTurnPortRequest,
} from "./model-turn";

const prompt = {
	channel: "text",
	text: "Characterize the turn graph.",
} as const;
const completedFeedback = {
	id: "complete",
	command: "completeResponse",
	status: "accepted" as const,
	view: { status: "responding" },
	events: [{ type: "response-completed" }],
	attemptId: "turn-graph:1",
};

const traversedEvents = [
	{
		type: "MODEL_RESOLVED",
		turnId: "turn-graph",
		attemptId: "turn-graph:1",
		result: {
			ok: true,
			calls: [
				{
					id: "complete",
					command: "completeResponse",
					input: { text: "Release checklist ready." },
				},
			],
		},
	},
	{
		type: "AUTHORIZATION_RESOLVED",
		turnId: "turn-graph",
		attemptId: "turn-graph:1",
		allowed: true,
	},
	{
		type: "CAPABILITY_RESOLVED",
		turnId: "turn-graph",
		attemptId: "turn-graph:1",
		feedback: completedFeedback,
	},
	{
		type: "PORT_FAILED",
		turnId: "turn-graph",
		attemptId: "turn-graph:1",
		failure: { kind: "provider", message: "Graph port failed." },
	},
	{ type: "CANCEL", turnId: "turn-graph" },
	{ type: "TIMEOUT", turnId: "turn-graph" },
] as const satisfies readonly ModelTurnLifecycleEvent[];

type GraphEventDisposition = "traversed" | "context-cycle";

const graphEventPolicy = {
	MODEL_RESOLVED: "traversed",
	AUTHORIZATION_RESOLVED: "traversed",
	CAPABILITY_RESOLVED: "traversed",
	PORT_FAILED: "traversed",
	CANCEL: "traversed",
	TIMEOUT: "traversed",
} as const satisfies Record<
	ModelTurnLifecycleEvent["type"],
	GraphEventDisposition
>;

const serializeState = (snapshot: ModelTurnSnapshot) =>
	JSON.stringify({
		value: snapshot.value,
		round: snapshot.context.round,
		attemptId: snapshot.context.attemptId,
		terminal: snapshot.context.terminal?.type ?? null,
	});

const traversalOptions = {
	events: traversedEvents,
	filterEvents: (
		_snapshot: ModelTurnSnapshot,
		event: ModelTurnLifecycleEvent,
	) => graphEventPolicy[event.type] === "traversed",
	limit: 64,
	serializeEvent: (event: ModelTurnLifecycleEvent) => JSON.stringify(event),
	serializeState,
	stopWhen: () => false,
};

describe("model-turn graph characterization", () => {
	it("declares the exact source state topology", () => {
		expect(Object.keys(modelTurnMachine.config.states ?? {})).toEqual([
			"requesting",
			"authorizing",
			"executing",
			"completed",
			"failed",
			"cancelled",
			"timed-out",
			"exhausted",
		]);
	});

	it("uses bounded graph traversal for each reachable lifecycle vertex", () => {
		const shortest = getShortestPaths(modelTurnMachine, {
			...traversalOptions,
			input: { turnId: "turn-graph", prompt },
		});
		const simple = getSimplePaths(modelTurnMachine, {
			...traversalOptions,
			input: { turnId: "turn-graph", prompt },
		});
		const reached = new Set(
			shortest.map((path) => JSON.stringify(path.state.value)),
		);
		expect(reached).toEqual(
			new Set([
				JSON.stringify("requesting"),
				JSON.stringify("authorizing"),
				JSON.stringify("executing"),
				JSON.stringify("completed"),
				JSON.stringify("failed"),
				JSON.stringify("cancelled"),
				JSON.stringify("timed-out"),
			]),
		);
		expect(
			new Set(simple.map((path) => JSON.stringify(path.state.value))),
		).toEqual(reached);
	});

	it("keeps stale receipts inert and serializes the terminal output contract", () => {
		const actor = createModelTurnActor({
			turnId: "turn-graph",
			prompt,
		}).start();
		actor.send({
			type: "MODEL_RESOLVED",
			turnId: "turn-graph",
			attemptId: "turn-graph:1",
			result: {
				ok: true,
				calls: [
					{
						id: "complete",
						command: "completeResponse",
						input: { text: "Release checklist ready." },
					},
				],
			},
		});
		actor.send({
			type: "AUTHORIZATION_RESOLVED",
			turnId: "turn-graph",
			attemptId: "stale-attempt",
			allowed: true,
		});
		expect(actor.getSnapshot().value).toBe("authorizing");
		actor.send({
			type: "AUTHORIZATION_RESOLVED",
			turnId: "turn-graph",
			attemptId: "turn-graph:1",
			allowed: true,
		});
		actor.send({
			type: "CAPABILITY_RESOLVED",
			turnId: "turn-graph",
			attemptId: "stale-attempt",
			feedback: completedFeedback,
		});
		expect(actor.getSnapshot().value).toBe("executing");
		actor.send({
			type: "CAPABILITY_RESOLVED",
			turnId: "turn-graph",
			attemptId: "turn-graph:1",
			feedback: completedFeedback,
		});

		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("completed");
		expect(projectModelTurnPortRequest(snapshot)).toBeNull();
		expect(projectModelTurnLifecycle(snapshot)).toMatchObject({
			state: "completed",
			turnId: "turn-graph",
			attemptId: "turn-graph:1",
		});
		expect(modelTurnStateFromTerminal(snapshot.context.terminal!)).toBe(
			"completed",
		);
		expect(() => JSON.stringify(snapshot.context)).not.toThrow();
		expect(snapshot.output).toEqual({
			terminal: snapshot.context.terminal,
			result: snapshot.context.lastResult,
		} satisfies ModelTurnOutput);
		actor.stop();
	});

	it("directly reaches exhaustion at the bounded round limit", () => {
		const actor = createActor(modelTurnMachine, {
			input: { turnId: "turn-exhausted", prompt },
		}).start();

		for (let round = 1; round <= MODEL_TURN_ROUND_LIMIT; round += 1) {
			const attemptId = `turn-exhausted:${round}`;
			expect(actor.getSnapshot().context.attemptId).toBe(attemptId);
			actor.send({
				type: "MODEL_RESOLVED",
				turnId: "turn-exhausted",
				attemptId,
				result: { ok: true, calls: [] },
			});
		}

		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("exhausted");
		expect(snapshot.context.round).toBe(MODEL_TURN_ROUND_LIMIT);
		expect(snapshot.context.terminal).toEqual({
			type: "ROUND_LIMIT_REACHED",
			turnId: "turn-exhausted",
			trace: snapshot.context.trace,
		});
		expect(modelTurnStateFromTerminal(snapshot.context.terminal!)).toBe(
			"exhausted",
		);
		expect(snapshot.output).toEqual({
			terminal: snapshot.context.terminal,
			result: snapshot.context.lastResult,
		} satisfies ModelTurnOutput);
		expect(projectModelTurnPortRequest(snapshot)).toBeNull();
		expect(() => JSON.stringify(snapshot.context)).not.toThrow();
		actor.stop();
	});
});
