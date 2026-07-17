import { afterEach, describe, expect, it } from "vitest";
import type { ModelToolFeedback } from "./agent-loop";
import type { ModelTurnPortRequest } from "./model-turn";
import type {
	ModelTurnPortReceipt,
	VoiceCapturePortReceipt,
} from "./ports";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
	voiceWorkbenchLifecycleOwnership,
	voiceWorkbenchSessionInvariants,
} from "./session";

const actors = new Set<VoiceWorkbenchSessionActor>();

afterEach(() => {
	for (const actor of actors) actor.stop();
	actors.clear();
});

const createSession = (input?: Parameters<typeof createVoiceWorkbenchSessionActor>[0]) => {
	const actor = createVoiceWorkbenchSessionActor(input).start();
	actors.add(actor);
	return actor;
};

const makeAvailable = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.modelPreparation;
	if (!request) throw new Error("Expected a model preparation request.");
	actor.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt: { type: "available", sequence: request.sequence },
	});
};

const currentModelRequest = (
	actor: VoiceWorkbenchSessionActor,
): ModelTurnPortRequest => {
	const request = actor.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected a model-turn port request.");
	return request;
};

const sendModelReceipt = (
	actor: VoiceWorkbenchSessionActor,
	receipt: ModelTurnPortReceipt,
) => {
	const request = currentModelRequest(actor);
	actor.send({ type: "MODEL_TURN_PORT_RECEIVED", request, receipt });
};

const acceptedFeedback = (
	request: ModelTurnPortRequest,
): ModelToolFeedback => ({
	id: request.type === "execute-call" ? request.call.id ?? "complete" : "complete",
	command:
		request.type === "execute-call" ? request.call.command : "completeResponse",
	status: "accepted",
	ownerId: "workbench-component",
	view: {},
	events: [],
});

const completeTurn = (
	actor: VoiceWorkbenchSessionActor,
	options: { speech?: string } = {},
) => {
	actor.send({
		type: "CREATE_ARTIFACT",
		input: {
			id: "artifact-1",
			nodes: [{ id: "summary", kind: "text", text: "Ready" }],
		},
	});

	let request = currentModelRequest(actor);
	expect(request.type).toBe("request-model");
	sendModelReceipt(actor, {
		type: "MODEL_RESOLVED",
		turnId: request.turnId,
		attemptId: request.attemptId,
		result: {
			ok: true,
			calls: [
				{
					id: "complete",
					command: "completeResponse",
					input: {
						text: "Done",
						...(options.speech ? { speech: options.speech } : {}),
					},
				},
			],
		},
	});

	request = currentModelRequest(actor);
	expect(request.type).toBe("authorize-call");
	sendModelReceipt(actor, {
		type: "AUTHORIZATION_RESOLVED",
		turnId: request.turnId,
		attemptId: request.attemptId,
		allowed: true,
	});

	request = currentModelRequest(actor);
	expect(request.type).toBe("execute-call");
	actor.send({
		type: "COMPLETE_RESPONSE",
		input: {
			text: "Done",
			...(options.speech ? { speech: options.speech } : {}),
		},
	});
	sendModelReceipt(actor, {
		type: "CAPABILITY_RESOLVED",
		turnId: request.turnId,
		attemptId: request.attemptId,
		feedback: acceptedFeedback(request),
	});
};

const sendVoiceReceipt = (
	actor: VoiceWorkbenchSessionActor,
	receipt: VoiceCapturePortReceipt,
) => {
	const request = actor.getSnapshot().context.portRequests.voiceCapture;
	if (!request) throw new Error("Expected a voice-capture port request.");
	actor.send({ type: "VOICE_CAPTURE_PORT_RECEIVED", request, receipt });
};

describe("voice workbench parent-supervised actor system", () => {
	it("enters the canonical parallel available topology with fixed child ids", () => {
		const actor = createSession();
		makeAvailable(actor);

		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toEqual({
			available: { turn: "idle", voice: "active", speech: "idle" },
		});
		expect(Object.keys(snapshot.children)).toEqual(["voice-capture"]);
		expect(snapshot.children["voice-capture"]?.getSnapshot().value).toBe(
			"idle",
		);
		expect(voiceWorkbenchSessionInvariants.respondingRequiresAvailable(snapshot)).toBe(
			true,
		);
		expect(voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(snapshot)).toBe(
			true,
		);
	});

	it("invokes one model-turn child and commits only its correlated final output", () => {
		const actor = createSession();
		makeAvailable(actor);
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Create a summary" },
		});

		const responding = actor.getSnapshot();
		expect(responding.matches({ available: { turn: "responding" } })).toBe(
			true,
		);
		expect(Object.keys(responding.children).sort()).toEqual([
			"model-turn",
			"voice-capture",
		]);

		const stale = currentModelRequest(actor);
		actor.send({
			type: "MODEL_TURN_PORT_RECEIVED",
			request: stale,
			receipt: {
				type: "PORT_FAILED",
				turnId: stale.turnId,
				attemptId: `${stale.attemptId}:stale`,
				failure: { kind: "provider", message: "stale" },
			},
		});
		expect(actor.getSnapshot().matches({ available: { turn: "responding" } })).toBe(
			true,
		);

		completeTurn(actor);
		const completed = actor.getSnapshot();
		expect(completed.matches({ available: { turn: "idle" } })).toBe(true);
		expect(completed.children["model-turn"]).toBeUndefined();
		expect(completed.context.response?.text).toBe("Done");
		expect(completed.context.lastTurnTerminal?.type).toBe("TURN_COMPLETED");
		expect(completed.context.presentation.turn?.type).toBe("accepted");
	});

	it("stops the model-turn child when the parent leaves its owning state", () => {
		const actor = createSession();
		makeAvailable(actor);
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Wait" },
		});
		const child = actor.getSnapshot().children["model-turn"];
		expect(child?.getSnapshot().status).toBe("active");

		actor.send({ type: "MODEL_PREPARATION_STARTED" });

		expect(actor.getSnapshot().value).toBe("preparing");
		expect(actor.getSnapshot().children["model-turn"]).toBeUndefined();
		expect(child?.getSnapshot().status).toBe("stopped");
	});

	it("forwards only the current correlated cancel intent to the model-turn child", () => {
		const actor = createSession();
		makeAvailable(actor);
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Cancel this turn" },
		});
		const request = currentModelRequest(actor);

		actor.send({
			type: "MODEL_TURN_CANCEL_REQUESTED",
			turnId: request.turnId,
			attemptId: `${request.attemptId}:stale`,
		});
		expect(actor.getSnapshot().matches({ available: { turn: "responding" } })).toBe(
			true,
		);

		actor.send({
			type: "MODEL_TURN_CANCEL_REQUESTED",
			turnId: request.turnId,
			attemptId: request.attemptId,
		});
		const cancelled = actor.getSnapshot();
		expect(cancelled.matches({ available: { turn: "idle" } })).toBe(true);
		expect(cancelled.context.lastTurnTerminal).toEqual({
			type: "CANCELLED",
			turnId: request.turnId,
		});
		expect(cancelled.context.childLifecycles.modelTurn).toMatchObject({
			state: "cancelled",
			terminal: { type: "CANCELLED", turnId: request.turnId },
		});
	});

	it("lets the persistent voice child allocate correlation and submit a final transcript", () => {
		const actor = createSession();
		makeAvailable(actor);
		actor.send({ type: "VOICE_CAPTURE_START_REQUESTED" });

		const request = actor.getSnapshot().context.portRequests.voiceCapture;
		expect(request).toMatchObject({ type: "start", attemptId: "voice:1" });
		if (!request?.attemptId) throw new Error("Expected a voice attempt.");

		actor.send({
			type: "VOICE_CAPTURE_PORT_RECEIVED",
			request,
			receipt: {
				type: "RESULT",
				attemptId: "voice:stale",
				text: "Ignore me",
				final: true,
			},
		});
		expect(actor.getSnapshot().context.childLifecycles.voiceCapture?.state).toBe(
			"listening",
		);

		sendVoiceReceipt(actor, {
			type: "RESULT",
			attemptId: request.attemptId,
			text: "  Use this transcript  ",
			final: true,
		});
		expect(actor.getSnapshot().context.childLifecycles.voiceCapture).toMatchObject(
			{ state: "transcript", attemptId: request.attemptId },
		);

		actor.send({ type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
		const submitted = actor.getSnapshot();
		expect(submitted.matches({ available: { turn: "responding" } })).toBe(true);
		expect(submitted.context.lastFact).toMatchObject({
			type: "prompt-submitted",
			modality: "speech",
			text: "Use this transcript",
		});
		expect(submitted.context.voiceTranscriptSubmission).toBeNull();
		expect(submitted.context.childLifecycles.voiceCapture?.state).toBe("consumed");
	});

	it("invokes and replaces speech-delivery children from actor-owned requests", () => {
		const actor = createSession();
		makeAvailable(actor);
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Speak the result" },
		});
		completeTurn(actor, { speech: "Done aloud" });

		let snapshot = actor.getSnapshot();
		expect(snapshot.matches({ available: { speech: "delivering" } })).toBe(true);
		const firstChild = snapshot.children["speech-delivery"];
		const firstRequest = snapshot.context.portRequests.speechDelivery;
		expect(firstRequest).toMatchObject({
			type: "speak",
			text: "Done aloud",
			requestSequence: 1,
		});
		if (!firstRequest) throw new Error("Expected a speech request.");

		actor.send({
			type: "SPEECH_DELIVERY_REPLAY_REQUESTED",
		});
		snapshot = actor.getSnapshot();
		const replayChild = snapshot.children["speech-delivery"];
		const replayRequest = snapshot.context.portRequests.speechDelivery;
		expect(firstChild?.getSnapshot().status).toBe("stopped");
		expect(replayChild).not.toBe(firstChild);
		expect(replayRequest?.requestSequence).toBe(2);
		if (!replayRequest) throw new Error("Expected a replay request.");

		actor.send({
			type: "SPEECH_DELIVERY_PORT_RECEIVED",
			request: replayRequest,
			receipt: { type: "QUEUED", attemptId: replayRequest.attemptId },
		});
		actor.send({
			type: "SPEECH_DELIVERY_PORT_RECEIVED",
			request: replayRequest,
			receipt: {
				type: "DELIVERED",
				attemptId: replayRequest.attemptId,
			},
		});

		snapshot = actor.getSnapshot();
		expect(snapshot.matches({ available: { speech: "idle" } })).toBe(true);
		expect(snapshot.children["speech-delivery"]).toBeUndefined();
		expect(snapshot.context.speech?.status).toBe("acknowledged");
		expect(snapshot.context.childLifecycles.speechDelivery?.terminal).toEqual({
			type: "speech-delivery-completed",
			id: snapshot.context.speech?.id,
		});
	});

	it("keeps fresh actors isolated", () => {
		const first = createSession({ voiceSupported: false });
		const second = createSession();
		makeAvailable(first);
		makeAvailable(second);
		first.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Only first" },
		});

		expect(first.getSnapshot().matches({ available: { turn: "responding" } })).toBe(
			true,
		);
		expect(second.getSnapshot().matches({ available: { turn: "idle" } })).toBe(
			true,
		);
		expect(first.getSnapshot().context.childLifecycles.voiceCapture?.state).toBe(
			"unsupported",
		);
		expect(second.getSnapshot().context.childLifecycles.voiceCapture?.state).toBe(
			"idle",
		);
	});

	it("publishes one executable target owner for each lifecycle surface", () => {
		expect(voiceWorkbenchLifecycleOwnership).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ surface: "model-turn", maturity: "target" }),
				expect.objectContaining({ surface: "voice-capture", maturity: "target" }),
				expect.objectContaining({ surface: "speech-delivery", maturity: "target" }),
			]),
		);
		expect(
			voiceWorkbenchLifecycleOwnership.every(
				(entry) => entry.implementation === "executable" && entry.maturity === "target",
			),
		).toBe(true);
	});
});
