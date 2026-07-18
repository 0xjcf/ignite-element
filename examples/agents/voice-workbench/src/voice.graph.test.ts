import { describe, expect, it } from "vitest";
import { getShortestPaths, getSimplePaths } from "xstate/graph";
import {
	createVoiceCaptureActor,
	projectVoiceCaptureLifecycle,
	projectVoiceCapturePortRequest,
	type VoiceCaptureEvent,
	type VoiceCaptureSnapshot,
	voiceCaptureMachine,
} from "./voice";

const graphEvents = [
	{ type: "START" },
	{
		type: "RESULT",
		attemptId: "voice:1",
		text: "Graph transcript",
		final: false,
	},
	{
		type: "RESULT",
		attemptId: "voice:1",
		text: "Graph transcript",
		final: true,
	},
	{ type: "END", attemptId: "voice:1" },
	{
		type: "PERMISSION_DENIED",
		attemptId: "voice:1",
		message: "Microphone permission denied.",
	},
	{ type: "FAIL", attemptId: "voice:1", message: "Microphone failed." },
	{ type: "CANCEL" },
	{ type: "CONSUME", attemptId: "voice:1" },
	{ type: "DISPOSE" },
] as const satisfies readonly VoiceCaptureEvent[];

type GraphEventDisposition = "traversed";

const graphEventPolicy = {
	START: "traversed",
	RESET: "traversed",
	RETRY: "traversed",
	RESULT: "traversed",
	END: "traversed",
	PERMISSION_DENIED: "traversed",
	FAIL: "traversed",
	CANCEL: "traversed",
	CONSUME: "traversed",
	DISPOSE: "traversed",
} as const satisfies Record<VoiceCaptureEvent["type"], GraphEventDisposition>;

const serializeState = (snapshot: VoiceCaptureSnapshot) =>
	JSON.stringify({
		value: snapshot.value,
		final: snapshot.context.final,
		hasTranscript: snapshot.context.transcript.trim().length > 0,
		message: snapshot.context.message,
		portAction: snapshot.context.portAction,
	});

const traversalOptions = {
	events: graphEvents,
	filterEvents: (_snapshot: VoiceCaptureSnapshot, event: VoiceCaptureEvent) =>
		graphEventPolicy[event.type] === "traversed",
	limit: 512,
	serializeEvent: (event: VoiceCaptureEvent) => JSON.stringify(event),
	serializeState,
	stopWhen: () => false,
};

describe("voice-capture graph characterization", () => {
	it("declares the exact source state topology", () => {
		expect(Object.keys(voiceCaptureMachine.config.states ?? {})).toEqual([
			"checking",
			"unsupported",
			"unavailable",
			"idle",
			"listening",
			"transcript",
			"consumed",
			"cancelled",
			"permission-denied",
			"failed",
			"disposed",
		]);
	});

	it("uses bounded graph traversal across the supported interactive lifecycle", () => {
		const shortest = getShortestPaths(voiceCaptureMachine, {
			...traversalOptions,
			input: { supported: true },
		});
		const simple = getSimplePaths(voiceCaptureMachine, {
			...traversalOptions,
			input: { supported: true },
		});
		const reached = new Set(
			shortest.map((path) => JSON.stringify(path.state.value)),
		);
		expect(reached).toEqual(
			new Set([
				JSON.stringify("idle"),
				JSON.stringify("listening"),
				JSON.stringify("transcript"),
				JSON.stringify("consumed"),
				JSON.stringify("cancelled"),
				JSON.stringify("permission-denied"),
				JSON.stringify("failed"),
				JSON.stringify("disposed"),
			]),
		);
		expect(
			new Set(simple.map((path) => JSON.stringify(path.state.value))),
		).toEqual(reached);
	});

	it("keeps unsupported and initialization-failure inputs as explicit non-graph exclusions", () => {
		const unsupported = createVoiceCaptureActor({ supported: false }).start();
		expect(unsupported.getSnapshot().value).toBe("unsupported");
		unsupported.stop();

		const unavailable = createVoiceCaptureActor({
			supported: false,
			initialError: "Speech recognition could not be initialized.",
		}).start();
		expect(unavailable.getSnapshot().value).toBe("unavailable");
		unavailable.stop();
	});

	it("keeps stale adapter receipts inert and preserves a serializable projection contract", () => {
		const actor = createVoiceCaptureActor({ supported: true }).start();
		actor.send({ type: "START" });
		actor.send({
			type: "RESULT",
			attemptId: "voice:stale",
			text: "Ignore me",
			final: true,
		});
		expect(actor.getSnapshot().value).toBe("listening");
		actor.send({
			type: "RESULT",
			attemptId: "voice:1",
			text: " Ready to ship ",
			final: true,
		});
		actor.send({ type: "CONSUME", attemptId: "voice:stale" });
		expect(actor.getSnapshot().value).toBe("transcript");
		actor.send({ type: "CONSUME", attemptId: "voice:1" });
		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("consumed");
		expect(projectVoiceCaptureLifecycle(snapshot)).toMatchObject({
			state: "consumed",
			attemptId: "voice:1",
			fact: { type: "voice-idle" },
		});
		expect(projectVoiceCapturePortRequest(snapshot)).toBeNull();
		expect(() => JSON.stringify(snapshot.context)).not.toThrow();
		actor.stop();
	});
});
