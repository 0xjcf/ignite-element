import { describe, expect, it } from "vitest";
import { getShortestPaths, getSimplePaths } from "xstate/graph";
import {
	createSpeechDeliveryActor,
	projectSpeechDeliveryLifecycle,
	projectSpeechDeliveryPortRequest,
	type SpeechDeliveryEvent,
	type SpeechDeliveryOutput,
	type SpeechDeliverySnapshot,
	speechDeliveryMachine,
	speechDeliveryStateFromTerminal,
} from "./speech";

const baseInput = {
	id: "speech-graph",
	text: "Ship the release.",
	attemptId: "speech-graph:1",
	requestSequence: 1,
} as const;

const graphEvents = [
	{ type: "QUEUED", attemptId: "speech-graph:1" },
	{ type: "DELIVERED", attemptId: "speech-graph:1" },
	{ type: "MUTED", attemptId: "speech-graph:1" },
	{ type: "UNAVAILABLE", attemptId: "speech-graph:1" },
	{
		type: "FAIL",
		attemptId: "speech-graph:1",
		message: "Audio output failed.",
	},
	{ type: "CANCEL", attemptId: "speech-graph:1" },
	{ type: "DISPOSE" },
] as const satisfies readonly SpeechDeliveryEvent[];

type GraphEventDisposition = "traversed";

const graphEventPolicy = {
	QUEUED: "traversed",
	DELIVERED: "traversed",
	MUTED: "traversed",
	UNAVAILABLE: "traversed",
	FAIL: "traversed",
	CANCEL: "traversed",
	DISPOSE: "traversed",
} as const satisfies Record<SpeechDeliveryEvent["type"], GraphEventDisposition>;

const serializeState = (snapshot: SpeechDeliverySnapshot) =>
	JSON.stringify({
		value: snapshot.value,
		portAction: snapshot.context.portAction,
		terminal: snapshot.context.terminal?.type ?? null,
	});

const traversalOptions = {
	events: graphEvents,
	filterEvents: (
		_snapshot: SpeechDeliverySnapshot,
		event: SpeechDeliveryEvent,
	) => graphEventPolicy[event.type] === "traversed",
	limit: 64,
	serializeEvent: (event: SpeechDeliveryEvent) => JSON.stringify(event),
	serializeState,
	stopWhen: () => false,
};

describe("speech-delivery graph characterization", () => {
	it("declares the exact source state topology", () => {
		expect(Object.keys(speechDeliveryMachine.config.states ?? {})).toEqual([
			"pending",
			"queued",
			"delivered",
			"muted",
			"unavailable",
			"failed",
			"cancelled",
			"disposed",
		]);
	});

	it("uses bounded graph traversal for every reachable live delivery vertex", () => {
		const shortest = getShortestPaths(speechDeliveryMachine, {
			...traversalOptions,
			input: baseInput,
		});
		const simple = getSimplePaths(speechDeliveryMachine, {
			...traversalOptions,
			input: baseInput,
		});
		const reached = new Set(
			shortest.map((path) => JSON.stringify(path.state.value)),
		);
		expect(reached).toEqual(
			new Set([
				JSON.stringify("pending"),
				JSON.stringify("queued"),
				JSON.stringify("delivered"),
				JSON.stringify("muted"),
				JSON.stringify("unavailable"),
				JSON.stringify("failed"),
				JSON.stringify("cancelled"),
				JSON.stringify("disposed"),
			]),
		);
		expect(
			new Set(simple.map((path) => JSON.stringify(path.state.value))),
		).toEqual(reached);
	});

	it("keeps stale receipts inert and preserves the terminal output contract", () => {
		const actor = createSpeechDeliveryActor(baseInput).start();
		actor.send({ type: "QUEUED", attemptId: "stale" });
		expect(actor.getSnapshot().value).toBe("pending");
		actor.send({ type: "QUEUED", attemptId: "speech-graph:1" });
		actor.send({ type: "DELIVERED", attemptId: "stale" });
		expect(actor.getSnapshot().value).toBe("queued");
		actor.send({ type: "DELIVERED", attemptId: "speech-graph:1" });
		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("delivered");
		const terminal = snapshot.context.terminal;
		if (!terminal) throw new Error("Expected a delivered terminal fact.");
		expect(projectSpeechDeliveryPortRequest(snapshot)).toBeNull();
		expect(projectSpeechDeliveryLifecycle(snapshot)).toMatchObject({
			state: "delivered",
			id: "speech-graph",
		});
		expect(speechDeliveryStateFromTerminal(terminal)).toBe("delivered");
		expect(() => JSON.stringify(snapshot.context)).not.toThrow();
		expect(snapshot.output).toEqual({
			terminal,
		} satisfies SpeechDeliveryOutput);
		actor.stop();
	});
});
