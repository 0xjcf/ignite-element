import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";
import * as sessionModule from "./session";
import {
	component,
	createVoiceWorkbenchSessionActor,
	isVoiceWorkbenchKnownForbiddenStateValue,
	projectVoiceWorkbenchView,
	recordCapabilityOutcome,
	recordDomainPolicyDecision,
	recordRuntimeManifest,
	recordTurnTerminal,
	recordVoiceCaptureLifecycle,
	reportModelAvailable,
	reportModelFailure,
	source,
	type VoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionSnapshot,
	voiceWorkbenchKnownForbiddenStateValues,
	voiceWorkbenchLifecycleOwnership,
	voiceWorkbenchSessionInvariants,
	voiceWorkbenchSessionMachine,
	type WorkbenchSpeechAcknowledgementFact,
	type WorkbenchSpeechDeliveryFact,
	type WorkbenchSpeechLifecycleFact,
} from "./session";

type VoiceControlContext = VoiceWorkbenchSessionSnapshot["context"] & {
	voiceCaptureControlSequence: number;
	voiceCaptureControlRequest:
		| { action: "start" | "cancel"; sequence: number }
		| {
				action: "consume";
				attemptId: string;
				candidateText: string;
				sequence: number;
		  }
		| null;
};

type VoiceTranscriptCandidate = { attemptId: string; text: string };

const voiceControlContext = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): VoiceControlContext => snapshot.context as VoiceControlContext;

const sendSessionEvent = (
	actor: VoiceWorkbenchSessionActor,
	event: Record<string, unknown>,
): void => (actor.send as (event: unknown) => void)(event);

const transcriptCandidateSelector = () =>
	(
		sessionModule as typeof sessionModule & {
			selectVoiceTranscriptCandidate?: (
				context: VoiceWorkbenchSessionSnapshot["context"],
			) => VoiceTranscriptCandidate | null;
		}
	).selectVoiceTranscriptCandidate;

type PrivatePortRequest =
	| {
			command: "recordRuntimeManifest";
			input: Parameters<typeof recordRuntimeManifest>[0];
	  }
	| {
			command: "recordCapabilityOutcome";
			input: Parameters<typeof recordCapabilityOutcome>[0];
	  }
	| {
			command: "recordDomainPolicyDecision";
			input: Parameters<typeof recordDomainPolicyDecision>[0];
	  }
	| {
			command: "reportModelFailure";
			input: Parameters<typeof reportModelFailure>[0];
	  }
	| { command: "reportModelAvailable" };

const executePrivatePort = (request: PrivatePortRequest): void => {
	switch (request.command) {
		case "recordRuntimeManifest":
			recordRuntimeManifest(request.input);
			return;
		case "recordCapabilityOutcome":
			recordCapabilityOutcome(request.input);
			return;
		case "recordDomainPolicyDecision":
			recordDomainPolicyDecision(request.input);
			return;
		case "reportModelFailure":
			reportModelFailure(request.input);
			return;
		case "reportModelAvailable":
			reportModelAvailable();
			return;
	}
};

const nodes = [
	{
		kind: "checklist",
		id: "decision-checklist",
		items: [{ id: "verify", label: "Verify decision", checked: false }],
	},
	{
		kind: "decision-log",
		id: "decision-entries",
		entries: [
			{
				id: "ignite",
				title: "Runtime",
				decision: "Use Ignite",
				rationale: "One behavior model",
			},
		],
	},
	{
		kind: "action",
		id: "complete-response",
		label: "Complete response",
		commandName: "completeResponse",
		payload: { text: "Decision captured." },
	},
] as const;

describe("voice workbench session machine contract", () => {
	it("creates unstarted actors with isolated nested context", () => {
		const first: VoiceWorkbenchSessionActor =
			createVoiceWorkbenchSessionActor();
		const second = createVoiceWorkbenchSessionActor();
		const observed = vi.fn();
		first.subscribe(observed);

		const firstInitial: VoiceWorkbenchSessionSnapshot = first.getSnapshot();
		const secondInitial = second.getSnapshot();

		expect(observed).not.toHaveBeenCalled();
		expect(firstInitial.context).not.toBe(secondInitial.context);
		expect(firstInitial.context.presentation).not.toBe(
			secondInitial.context.presentation,
		);
		expect(firstInitial.context.messages).not.toBe(
			secondInitial.context.messages,
		);
		expect(firstInitial.context.documents).not.toBe(
			secondInitial.context.documents,
		);
		expect(firstInitial.context.artifactRevisions).not.toBe(
			secondInitial.context.artifactRevisions,
		);

		first.start();
		expect(observed).toHaveBeenCalledTimes(1);
		const firstPresentationBeforeUpdate =
			first.getSnapshot().context.presentation;
		first.send({
			type: "PRESENTATION_UPDATED",
			envelope: {
				channel: "user-intent",
				update: { type: "draft-changed", draft: "first only" },
			},
		});
		expect(firstPresentationBeforeUpdate.draft).toBe("");
		expect(first.getSnapshot().context.presentation).not.toBe(
			firstPresentationBeforeUpdate,
		);
		expect(first.getSnapshot().context.presentation.draft).toBe("first only");
		expect(second.getSnapshot().context.presentation.draft).toBe("");

		second.start();
		first.stop();
		second.stop();
	});

	it("preserves the started source and publishes one owner per surface", () => {
		expect(source.logic).toBe(voiceWorkbenchSessionMachine);
		expect(source.getSnapshot().status).toBe("active");
		expect(voiceWorkbenchLifecycleOwnership).toEqual([
			expect.objectContaining({
				surface: "session-provider-turn",
				owner: "voiceWorkbenchSessionMachine",
				implementation: "executable",
				maturity: "target",
			}),
			expect.objectContaining({
				surface: "model-turn",
				implementation: "executable",
			}),
			expect.objectContaining({
				surface: "voice-capture",
				implementation: "executable",
			}),
			expect.objectContaining({
				surface: "speech-delivery",
				implementation: "executable",
			}),
			expect.objectContaining({
				surface: "conversation-artifact-aggregate",
				owner: "reduceConversationSession",
			}),
			expect.objectContaining({ surface: "domain-policy" }),
			expect.objectContaining({ surface: "capability-results" }),
			expect.objectContaining({
				surface: "presentation",
				owner: "reduceWorkbenchPresentation",
				disposition: "reducer",
				maturity: "target",
			}),
		]);
	});

	it("keeps aggregate completion separate from correlated terminal outcomes", () => {
		const startTurn = () => {
			const actor = createVoiceWorkbenchSessionActor();
			actor.start();
			actor.send({ type: "MODEL_AVAILABLE" });
			actor.send({
				type: "SUBMIT_PROMPT",
				input: { modality: "text", text: "Exercise terminal outcomes." },
			});
			expect(actor.getSnapshot().context.activeTurnId).toBe(
				"voice-workbench:1",
			);
			return actor;
		};

		const completed = startTurn();
		completed.send({
			type: "COMPLETE_RESPONSE",
			input: { text: "Aggregate response accepted." },
		});
		expect(completed.getSnapshot().value).toEqual({
			available: "responding",
		});
		expect(completed.getSnapshot().context.response).toBeNull();
		expect(completed.getSnapshot().context.lastFact?.type).toBe(
			"prompt-submitted",
		);
		expect(
			(
				completed.getSnapshot().context as unknown as {
					pendingCompletion?: { text: string } | null;
				}
			).pendingCompletion,
		).toEqual({ text: "Aggregate response accepted." });
		completed.send({ type: "TURN_COMPLETED", turnId: "stale-turn" });
		expect(completed.getSnapshot().value).toEqual({
			available: "responding",
		});
		expect(completed.getSnapshot().context.response).toBeNull();
		completed.send({
			type: "TURN_COMPLETED",
			turnId: "voice-workbench:1",
		});
		expect(completed.getSnapshot().value).toEqual({ available: "idle" });
		expect(completed.getSnapshot().context.response).toEqual({
			text: "Aggregate response accepted.",
		});
		expect(completed.getSnapshot().context.lastFact?.type).toBe(
			"response-completed",
		);
		const committedFactSequence = completed.getSnapshot().context.factSequence;
		completed.send({
			type: "TURN_COMPLETED",
			turnId: "voice-workbench:1",
		});
		expect(completed.getSnapshot().context.factSequence).toBe(
			committedFactSequence,
		);
		expect(
			completed
				.getSnapshot()
				.context.messages.filter((message) => message.role === "assistant"),
		).toHaveLength(1);
		completed.stop();

		const nonSuccessEvents = [
			{
				type: "TURN_FAILED",
				turnId: "voice-workbench:1",
				failure: { kind: "provider", message: "Turn execution failed." },
			},
			{ type: "CANCELLED", turnId: "voice-workbench:1" },
			{ type: "TIMEOUT", turnId: "voice-workbench:1" },
			{ type: "ROUND_LIMIT_REACHED", turnId: "voice-workbench:1" },
		] as const;

		for (const terminal of nonSuccessEvents) {
			const actor = startTurn();
			actor.send({
				type: "COMPLETE_RESPONSE",
				input: {
					text: "This completion must not survive the terminal race.",
					speech: "Do not speak this completion.",
				},
			});
			expect(actor.getSnapshot().context.response).toBeNull();
			actor.send(terminal);
			expect(actor.getSnapshot().value).toEqual({ available: "idle" });
			expect(actor.getSnapshot().context.response).toBeNull();
			expect(actor.getSnapshot().context.speech).toBeNull();
			expect(actor.getSnapshot().context.lastFact?.type).toBe(
				"prompt-submitted",
			);
			expect(
				actor
					.getSnapshot()
					.context.messages.some((message) => message.role === "assistant"),
			).toBe(false);
			expect(actor.getSnapshot().context.lastTurnTerminal).toEqual(terminal);
			actor.stop();
		}
	});

	it("rejects stale model, speech, and voice lifecycle projections at the parent boundary", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		actor.send({ type: "MODEL_AVAILABLE" });
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Start the first correlated turn." },
		});
		actor.send({ type: "CANCELLED", turnId: "voice-workbench:1" });
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Start the second correlated turn." },
		});

		actor.send({
			type: "MODEL_TURN_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "requesting",
				turnId: "voice-workbench:2",
				attemptId: "voice-workbench:2:1",
				round: 1,
				terminal: null,
			},
		});
		actor.send({
			type: "MODEL_TURN_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "completed",
				turnId: "voice-workbench:1",
				attemptId: "voice-workbench:1:1",
				round: 1,
				terminal: {
					type: "TURN_COMPLETED",
					turnId: "voice-workbench:1",
					trace: [],
				},
			},
		});
		expect(actor.getSnapshot().context.childLifecycles.modelTurn).toMatchObject(
			{
				state: "requesting",
				turnId: "voice-workbench:2",
				attemptId: "voice-workbench:2:1",
			},
		);

		actor.send({
			type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "queued",
				id: "speech-1",
				text: "First delivery",
				attemptId: "speech-1:1",
				fact: { type: "speech-delivery-queued", id: "speech-1" },
				terminal: null,
			},
		});
		actor.send({
			type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "pending",
				id: "speech-2",
				text: "Second delivery",
				attemptId: "speech-2:2",
				fact: null,
				terminal: null,
			},
		});
		actor.send({
			type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "queued",
				id: "speech-2",
				text: "Second delivery",
				attemptId: "speech-2:2",
				fact: { type: "speech-delivery-queued", id: "speech-2" },
				terminal: null,
			},
		});
		actor.send({
			type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "delivered",
				id: "speech-1",
				text: "First delivery",
				attemptId: "speech-1:1",
				fact: { type: "speech-delivery-completed", id: "speech-1" },
				terminal: { type: "speech-delivery-completed", id: "speech-1" },
			},
		});
		expect(
			actor.getSnapshot().context.childLifecycles.speechDelivery,
		).toMatchObject({
			state: "queued",
			id: "speech-2",
			attemptId: "speech-2:2",
		});
		expect(actor.getSnapshot().context.presentation.speechDelivery).toEqual({
			type: "speech-delivery-queued",
			id: "speech-2",
		});

		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "listening",
				attemptId: "voice:2",
				sequence: 2,
				fact: { type: "voice-listening" },
			},
		});
		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "transcript",
				attemptId: "voice:1",
				sequence: 1,
				fact: { type: "voice-transcript", text: "stale", final: true },
			},
		});
		expect(
			actor.getSnapshot().context.childLifecycles.voiceCapture,
		).toMatchObject({
			state: "listening",
			attemptId: "voice:2",
			sequence: 2,
		});
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).presentation
				.voice,
		).toEqual({ type: "voice-listening" });
		expect(actor.getSnapshot().context.presentation).not.toHaveProperty(
			"voice",
		);
		actor.stop();
	});

	it("allocates payloadless voice intents in parent-owned control state", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		actor.send({ type: "MODEL_AVAILABLE" });
		sendSessionEvent(actor, { type: "VOICE_CAPTURE_START_REQUESTED" });
		expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
			voiceCaptureControlSequence: 1,
			voiceCaptureControlRequest: { action: "start", sequence: 1 },
		});
		sendSessionEvent(actor, { type: "VOICE_CAPTURE_CANCEL_REQUESTED" });
		expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
			voiceCaptureControlSequence: 2,
			voiceCaptureControlRequest: { action: "cancel", sequence: 2 },
		});
		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "transcript",
				attemptId: "voice:1",
				sequence: 1,
				fact: {
					type: "voice-transcript",
					text: "Create a correlated checklist",
					final: true,
				},
			},
		});
		sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
		expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
			voiceCaptureControlSequence: 3,
			voiceCaptureControlRequest: {
				action: "consume",
				attemptId: "voice:1",
				candidateText: "Create a correlated checklist",
				sequence: 3,
			},
		});
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).portRequests
				.voiceCapture,
		).toEqual({
			action: "consume",
			attemptId: "voice:1",
			sequence: 3,
		});
		expect(actor.getSnapshot().context.presentation).not.toHaveProperty(
			"voiceCaptureRequest",
		);
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).presentation,
		).not.toHaveProperty("voiceCaptureRequest");
		expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();
		actor.stop();
	});

	it("requires both request and attempt correlation before consuming a transcript", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		actor.send({ type: "MODEL_AVAILABLE" });
		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "transcript",
				attemptId: "voice:1",
				sequence: 1,
				fact: {
					type: "voice-transcript",
					text: "Create a correlated checklist",
					final: true,
				},
			},
		});
		sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
		sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
		expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
			voiceCaptureControlSequence: 2,
			voiceCaptureControlRequest: {
				action: "consume",
				attemptId: "voice:1",
				sequence: 2,
			},
		});

		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "consumed",
				attemptId: "voice:1",
				sequence: 1,
				fact: { type: "voice-idle" },
			},
		});
		sendSessionEvent(actor, {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			requestSequence: 1,
			attemptId: "voice:1",
			text: "Create a correlated checklist",
		});
		sendSessionEvent(actor, {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			requestSequence: 2,
			attemptId: "voice:stale",
			text: "Create a correlated checklist",
		});
		sendSessionEvent(actor, {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			requestSequence: 2,
			attemptId: "voice:1",
			text: "Wrong transcript",
		});
		sendSessionEvent(actor, {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			text: "Ignore missing correlation",
		});
		expect(actor.getSnapshot().value).toEqual({ available: "idle" });
		expect(actor.getSnapshot().context.messages).toEqual([]);
		expect(
			voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
		).toMatchObject({ action: "consume", attemptId: "voice:1", sequence: 2 });

		const accepted = {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			requestSequence: 2,
			attemptId: "voice:1",
			text: "Create a correlated checklist",
		};
		sendSessionEvent(actor, accepted);
		expect(actor.getSnapshot().value).toEqual({ available: "responding" });
		expect(actor.getSnapshot().context.messages).toEqual([
			{
				role: "user",
				channel: "speech",
				text: "Create a correlated checklist",
			},
		]);
		expect(
			voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
		).toBeNull();
		expect(
			voiceControlContext(actor.getSnapshot()).voiceCaptureControlSequence,
		).toBe(2);

		sendSessionEvent(actor, accepted);
		expect(actor.getSnapshot().context.messages).toHaveLength(1);
		actor.stop();
	});

	it("uses one final-current transcript candidate for view and parent admission", () => {
		const selectVoiceTranscriptCandidate = transcriptCandidateSelector();
		if (!selectVoiceTranscriptCandidate) {
			throw new Error("selectVoiceTranscriptCandidate must be exported");
		}
		const cases = [
			{
				lifecycle: {
					state: "transcript",
					attemptId: "voice:1",
					sequence: 1,
					fact: {
						type: "voice-transcript",
						text: "  Current final transcript  ",
						final: true,
					},
				} as const,
				candidate: {
					attemptId: "voice:1",
					text: "Current final transcript",
				},
			},
			{
				lifecycle: {
					state: "transcript",
					attemptId: "voice:2",
					sequence: 2,
					fact: {
						type: "voice-transcript",
						text: "Interim transcript",
						final: false,
					},
				} as const,
				candidate: null,
			},
			{
				lifecycle: {
					state: "transcript",
					attemptId: null,
					sequence: 3,
					fact: {
						type: "voice-transcript",
						text: "Missing attempt",
						final: true,
					},
				} as const,
				candidate: null,
			},
			{
				lifecycle: {
					state: "transcript",
					attemptId: "voice:4",
					sequence: 4,
					fact: { type: "voice-transcript", text: " ", final: true },
				} as const,
				candidate: null,
			},
		] as const;

		for (const { lifecycle, candidate } of cases) {
			const actor = createVoiceWorkbenchSessionActor().start();
			actor.send({ type: "MODEL_AVAILABLE" });
			actor.send({ type: "VOICE_CAPTURE_LIFECYCLE_UPDATED", lifecycle });
			const snapshot = actor.getSnapshot();
			expect(selectVoiceTranscriptCandidate(snapshot.context)).toEqual(
				candidate,
			);
			expect(projectVoiceWorkbenchView({ snapshot }).transcriptReady).toBe(
				candidate !== null,
			);
			sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
			expect(
				voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
			).toEqual(
				candidate
					? {
							action: "consume",
							attemptId: candidate.attemptId,
							candidateText: candidate.text,
							sequence: 1,
						}
					: null,
			);
			actor.stop();
		}
	});

	it("keeps every visible voice fact aligned with the authoritative child lifecycle", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		actor.send({ type: "MODEL_AVAILABLE" });
		const selectVoiceTranscriptCandidate = transcriptCandidateSelector();
		if (!selectVoiceTranscriptCandidate) {
			throw new Error("selectVoiceTranscriptCandidate must be exported");
		}
		const expectVisibleVoice = (
			fact:
				| { type: "voice-listening" }
				| { type: "voice-permission-denied"; message: string }
				| {
						type: "voice-transcript";
						text: string;
						final: boolean;
				  },
		) => {
			const snapshot = actor.getSnapshot();
			const view = projectVoiceWorkbenchView({ snapshot });
			expect(view.presentation.voice).toEqual(fact);
			expect(view.transcript).toBe(
				fact.type === "voice-transcript" ? fact.text : null,
			);
			expect(view.transcriptReady).toBe(
				fact.type === "voice-transcript" && fact.final,
			);
			expect(view.voiceState).toBe(
				fact.type === "voice-listening"
					? "listening"
					: fact.type === "voice-transcript"
						? "transcript"
						: "permission",
			);
			expect(view.voiceFailure).toEqual(
				fact.type === "voice-permission-denied" ? fact : null,
			);
		};

		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "listening",
				attemptId: "voice:1",
				sequence: 1,
				fact: { type: "voice-listening" },
			},
		});
		expectVisibleVoice({ type: "voice-listening" });
		expect(
			selectVoiceTranscriptCandidate(actor.getSnapshot().context),
		).toBeNull();

		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "permission-denied",
				attemptId: "voice:2",
				sequence: 2,
				fact: {
					type: "voice-permission-denied",
					message: "Lifecycle permission failure",
				},
			},
		});
		expectVisibleVoice({
			type: "voice-permission-denied",
			message: "Lifecycle permission failure",
		});
		expect(
			selectVoiceTranscriptCandidate(actor.getSnapshot().context),
		).toBeNull();

		const lifecycleReceipt = {
			type: "voice-transcript",
			text: "  Lifecycle candidate\n",
			final: true,
		} as const;
		const lifecycleCandidate = {
			...lifecycleReceipt,
			text: "Lifecycle candidate",
		} as const;
		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "transcript",
				attemptId: "voice:3",
				sequence: 3,
				fact: lifecycleReceipt,
			},
		});
		expectVisibleVoice(lifecycleCandidate);
		expect(
			actor.getSnapshot().context.childLifecycles.voiceCapture?.fact,
		).toEqual(lifecycleCandidate);
		expect(selectVoiceTranscriptCandidate(actor.getSnapshot().context)).toEqual(
			{
				attemptId: "voice:3",
				text: "Lifecycle candidate",
			},
		);

		expect(sessionModule).not.toHaveProperty("presentVoice");
		expectVisibleVoice(lifecycleCandidate);
		expect(selectVoiceTranscriptCandidate(actor.getSnapshot().context)).toEqual(
			{
				attemptId: "voice:3",
				text: "Lifecycle candidate",
			},
		);

		sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
		expect(
			voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
		).toEqual({
			action: "consume",
			attemptId: "voice:3",
			candidateText: "Lifecycle candidate",
			sequence: 1,
		});
		expectVisibleVoice(lifecycleCandidate);

		actor.send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "consumed",
				attemptId: "voice:3",
				sequence: 3,
				fact: { type: "voice-idle" },
			},
		});
		sendSessionEvent(actor, {
			type: "VOICE_TRANSCRIPT_CONSUMED",
			requestSequence: 1,
			attemptId: "voice:3",
			text: "Lifecycle candidate",
		});
		expect(actor.getSnapshot().context.messages).toEqual([
			{
				role: "user",
				channel: "speech",
				text: "Lifecycle candidate",
			},
		]);
		expect(actor.getSnapshot().context.presentation).not.toHaveProperty(
			"voice",
		);
		actor.stop();
	});

	it.each([
		[
			"model preparation",
			{ type: "MODEL_PREPARATION_STARTED" } as const,
			"preparing",
		],
		[
			"model failure",
			{
				type: "MODEL_FAILED",
				failure: { kind: "network", message: "Provider interrupted consume." },
			} as const,
			"unavailable",
		],
	])(
		"keeps voice control sequencing monotonic across %s recovery",
		(_label, interruption, interruptedState) => {
			const actor = createVoiceWorkbenchSessionActor().start();
			actor.send({ type: "MODEL_AVAILABLE" });
			sendSessionEvent(actor, { type: "VOICE_CAPTURE_START_REQUESTED" });
			sendSessionEvent(actor, { type: "VOICE_CAPTURE_CANCEL_REQUESTED" });
			actor.send({
				type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
				lifecycle: {
					state: "transcript",
					attemptId: "voice:1",
					sequence: 1,
					fact: {
						type: "voice-transcript",
						text: "Do not replay this transcript",
						final: true,
					},
				},
			});
			sendSessionEvent(actor, { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" });
			expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
				voiceCaptureControlSequence: 3,
				voiceCaptureControlRequest: {
					action: "consume",
					attemptId: "voice:1",
					sequence: 3,
				},
			});
			actor.send({
				type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
				lifecycle: {
					state: "consumed",
					attemptId: "voice:1",
					sequence: 1,
					fact: { type: "voice-idle" },
				},
			});
			const lifecycleEvidence =
				actor.getSnapshot().context.childLifecycles.voiceCapture;

			actor.send(interruption);
			expect(actor.getSnapshot().value).toBe(interruptedState);
			expect(
				voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
			).toBeNull();
			expect(
				voiceControlContext(actor.getSnapshot()).voiceCaptureControlSequence,
			).toBe(3);
			expect(actor.getSnapshot().context.childLifecycles.voiceCapture).toEqual(
				lifecycleEvidence,
			);

			actor.send({ type: "MODEL_AVAILABLE" });
			sendSessionEvent(actor, {
				type: "VOICE_TRANSCRIPT_CONSUMED",
				requestSequence: 3,
				attemptId: "voice:1",
				text: "Do not replay this transcript",
			});
			expect(actor.getSnapshot().value).toEqual({ available: "idle" });
			expect(actor.getSnapshot().context.messages).toEqual([]);
			sendSessionEvent(actor, { type: "VOICE_CAPTURE_START_REQUESTED" });
			expect(voiceControlContext(actor.getSnapshot())).toMatchObject({
				voiceCaptureControlSequence: 4,
				voiceCaptureControlRequest: { action: "start", sequence: 4 },
			});
			actor.stop();
		},
	);

	it("preserves non-consume voice requests across provider readiness changes", () => {
		for (const action of ["start", "cancel"] as const) {
			const actor = createVoiceWorkbenchSessionActor().start();
			actor.send({ type: "MODEL_AVAILABLE" });
			sendSessionEvent(actor, {
				type:
					action === "start"
						? "VOICE_CAPTURE_START_REQUESTED"
						: "VOICE_CAPTURE_CANCEL_REQUESTED",
			});
			actor.send({ type: "MODEL_PREPARATION_STARTED" });
			expect(
				voiceControlContext(actor.getSnapshot()).voiceCaptureControlRequest,
			).toEqual({ action, sequence: 1 });
			actor.stop();
		}
	});

	it("projects turn interruption and rejects stale asynchronous read-model facts", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		actor.send({ type: "MODEL_AVAILABLE" });
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Start turn A." },
		});
		actor.send({
			type: "MODEL_TURN_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "requesting",
				turnId: "voice-workbench:1",
				attemptId: "voice-workbench:1:1",
				round: 1,
				terminal: null,
			},
		});

		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).portRequests
				.modelTurnControl,
		).toBeNull();
		actor.send({ type: "MODEL_PREPARATION_STARTED" });
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).portRequests
				.modelTurnControl,
		).toEqual({
			action: "cancel",
			turnId: "voice-workbench:1",
			sequence: 1,
		});
		expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();

		actor.send({ type: "MODEL_AVAILABLE" });
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Start turn B." },
		});
		actor.send({
			type: "MODEL_TURN_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "requesting",
				turnId: "voice-workbench:2",
				attemptId: "voice-workbench:2:1",
				round: 1,
				terminal: null,
			},
		});
		const sendPrivateEvent = actor.send as (event: unknown) => void;
		sendPrivateEvent({
			type: "RUNTIME_MANIFEST_RECORDED",
			turnId: "voice-workbench:1",
			attemptId: "voice-workbench:1:1",
			manifest: [
				{
					name: "staleRuntimeTool",
					inputSchema: { type: "object", properties: {} },
					gated: false,
					ownerId: "stale-owner",
				},
			],
		});
		sendPrivateEvent({
			type: "CAPABILITY_OUTCOME_RECORDED",
			turnId: "voice-workbench:1",
			attemptId: "voice-workbench:1:1",
			outcome: {
				type: "success",
				ownerId: "stale-owner",
				toolName: "staleCapability",
				message: "This fact belongs to turn A.",
			},
		});
		sendPrivateEvent({
			type: "DOMAIN_POLICY_RECORDED",
			turnId: "voice-workbench:1",
			attemptId: "voice-workbench:1:1",
			decision: {
				type: "domain-policy-decision",
				domainId: "stale-domain",
				domainLabel: "Stale domain",
				policyId: "stale-policy",
				policyLabel: "Stale policy",
				outcome: "admitted",
				summary: "This decision belongs to turn A.",
				assumptions: [],
				questions: [],
				evidenceRequirements: [],
			},
		});
		sendPrivateEvent({
			type: "TURN_RECORDED",
			turnId: "voice-workbench:1",
			attemptId: "voice-workbench:1:1",
			fact: { type: "accepted", trace: [] },
		});

		expect(actor.getSnapshot().context.activeTurnId).toBe("voice-workbench:2");
		expect(actor.getSnapshot().context.presentation).toMatchObject({
			runtimeManifest: [],
			capabilityOutcomes: [],
			domainPolicy: null,
			turn: null,
		});

		sendPrivateEvent({
			type: "CAPABILITY_OUTCOME_RECORDED",
			turnId: "voice-workbench:2",
			attemptId: "voice-workbench:2:1",
			outcome: {
				type: "success",
				ownerId: "current-owner",
				toolName: "currentCapability",
				message: "This fact belongs to turn B.",
			},
		});
		expect(actor.getSnapshot().context.presentation.capabilityOutcomes).toEqual(
			[expect.objectContaining({ toolName: "currentCapability" })],
		);
		actor.stop();

		const failedActor = createVoiceWorkbenchSessionActor().start();
		failedActor.send({ type: "MODEL_AVAILABLE" });
		failedActor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Interrupt this turn by failure." },
		});
		failedActor.send({
			type: "MODEL_FAILED",
			failure: { kind: "provider", message: "Provider failed." },
		});
		expect(
			projectVoiceWorkbenchView({ snapshot: failedActor.getSnapshot() })
				.portRequests.modelTurnControl,
		).toEqual({
			action: "cancel",
			turnId: "voice-workbench:1",
			sequence: 1,
		});
		failedActor.stop();
	});

	it("projects raw lifecycle snapshots without inventing a second state model", () => {
		const actor = createVoiceWorkbenchSessionActor().start();
		const assertProjection = () => {
			const snapshot = actor.getSnapshot();
			const view = projectVoiceWorkbenchView({ snapshot });
			expect(view.lifecycle).toMatchObject({
				state: snapshot.value,
				activeTurnId: snapshot.context.activeTurnId,
				lastTurnTerminal: snapshot.context.lastTurnTerminal,
				children: snapshot.context.childLifecycles,
			});
			expect(() => JSON.stringify(snapshot.context)).not.toThrow();
		};

		assertProjection();
		actor.send({ type: "MODEL_AVAILABLE" });
		assertProjection();
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Project this lifecycle." },
		});
		assertProjection();
		actor.send({
			type: "COMPLETE_RESPONSE",
			input: { text: "Projection accepted." },
		});
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).status,
		).toBe("responding");
		actor.send({ type: "TURN_COMPLETED", turnId: "voice-workbench:1" });
		assertProjection();
		expect(
			projectVoiceWorkbenchView({ snapshot: actor.getSnapshot() }).status,
		).toBe("ready");
		actor.stop();
	});

	it("defines transport-neutral acknowledgement and distinct delivery facts", () => {
		const acknowledgement = {
			type: "speech-acknowledged",
			id: "speech-1",
		} satisfies WorkbenchSpeechAcknowledgementFact;
		const deliveryFacts = [
			{ type: "speech-delivery-queued", id: "speech-1" },
			{ type: "speech-delivery-completed", id: "speech-1" },
			{ type: "speech-delivery-muted", id: "speech-1" },
			{ type: "speech-delivery-unavailable", id: "speech-1" },
			{
				type: "speech-delivery-failed",
				id: "speech-1",
				message: "Playback failed.",
			},
			{ type: "speech-delivery-cancelled", id: "speech-1" },
		] satisfies readonly WorkbenchSpeechDeliveryFact[];
		const lifecycleFacts = [
			acknowledgement,
			...deliveryFacts,
		] satisfies readonly WorkbenchSpeechLifecycleFact[];

		expect(lifecycleFacts.map((fact) => fact.type)).toEqual([
			"speech-acknowledged",
			"speech-delivery-queued",
			"speech-delivery-completed",
			"speech-delivery-muted",
			"speech-delivery-unavailable",
			"speech-delivery-failed",
			"speech-delivery-cancelled",
		]);
	});

	it("makes responding a child of available with no forbidden raw state", () => {
		expect(voiceWorkbenchKnownForbiddenStateValues).toEqual([]);

		const createRespondingActor = () => {
			const actor = createVoiceWorkbenchSessionActor();
			actor.start();
			actor.send({ type: "MODEL_AVAILABLE" });
			actor.send({
				type: "SUBMIT_PROMPT",
				input: { modality: "text", text: "Inspect the current topology" },
			});
			expect(actor.getSnapshot().value).toEqual({ available: "responding" });
			expect(
				voiceWorkbenchSessionInvariants.respondingRequiresAvailable(
					actor.getSnapshot(),
				),
			).toBe(true);
			return actor;
		};

		const preparingActor = createRespondingActor();
		preparingActor.send({ type: "MODEL_PREPARATION_STARTED" });
		const preparingSnapshot = preparingActor.getSnapshot();
		expect(preparingSnapshot.value).toBe("preparing");
		expect(
			isVoiceWorkbenchKnownForbiddenStateValue(preparingSnapshot.value),
		).toBe(false);
		expect(
			voiceWorkbenchSessionInvariants.respondingRequiresAvailable(
				preparingSnapshot,
			),
		).toBe(true);
		expect(
			voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(
				preparingSnapshot,
			),
		).toBe(true);
		preparingActor.stop();

		const failedActor = createRespondingActor();
		failedActor.send({
			type: "MODEL_FAILED",
			failure: { kind: "network", message: "Model connection lost." },
		});
		const failedSnapshot = failedActor.getSnapshot();
		expect(failedSnapshot.value).toBe("unavailable");
		expect(isVoiceWorkbenchKnownForbiddenStateValue(failedSnapshot.value)).toBe(
			false,
		);
		expect(
			voiceWorkbenchSessionInvariants.respondingRequiresAvailable(
				failedSnapshot,
			),
		).toBe(true);
		expect(
			voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(failedSnapshot),
		).toBe(true);
		expect(failedSnapshot.context).toMatchObject({
			modelFailure: { kind: "network", message: "Model connection lost." },
			response: null,
			presentation: {
				turn: {
					type: "model-failed",
					failureKind: "network",
					message: "Model connection lost.",
					trace: [],
				},
			},
		});
		expect(failedSnapshot.context.lastFact?.type).toBe("prompt-submitted");

		failedActor.send({
			type: "CREATE_ARTIFACT",
			input: {
				id: "blocked",
				nodes: [{ id: "copy", kind: "text", text: "No" }],
			},
		});
		failedActor.send({
			type: "COMPLETE_RESPONSE",
			input: { text: "Must remain incomplete." },
		});
		expect(failedActor.getSnapshot().context.documents).toEqual([]);
		expect(failedActor.getSnapshot().context.response).toBeNull();
		failedActor.stop();
	});
});

describe("voice workbench headless component", () => {
	it("drives one continuing projection-ready session directly", async () => {
		const schema = component.getSchema();
		expect(Object.keys(schema.commands)).toEqual([
			"acknowledgeSpeech",
			"beginModelPreparation",
			"cancelVoiceCapture",
			"changeArtifactView",
			"changeDraft",
			"changeMobilePanel",
			"changeSpeechPreference",
			"completeResponse",
			"createArtifact",
			"playSpeech",
			"replay",
			"restoreArtifactRevision",
			"reviseArtifact",
			"selectArtifact",
			"selectRuntimePreview",
			"setChecklistItem",
			"startVoiceCapture",
			"submitPrompt",
			"submitVoiceTranscript",
		]);
		expect(() => JSON.stringify(schema)).not.toThrow();
		expect(
			Object.fromEntries(
				Object.entries(schema.commands).map(([name, contract]) => [
					name,
					contract.channel,
				]),
			),
		).toEqual({
			acknowledgeSpeech: "user-intent",
			beginModelPreparation: "user-intent",
			cancelVoiceCapture: "user-intent",
			changeArtifactView: "user-intent",
			changeDraft: "user-intent",
			changeMobilePanel: "user-intent",
			changeSpeechPreference: "user-intent",
			completeResponse: "model-intent",
			createArtifact: "model-intent",
			playSpeech: "user-intent",
			replay: "user-intent",
			restoreArtifactRevision: "user-intent",
			reviseArtifact: "model-intent",
			selectArtifact: "user-intent",
			selectRuntimePreview: "user-intent",
			setChecklistItem: "model-intent",
			startVoiceCapture: "user-intent",
			submitPrompt: "user-intent",
			submitVoiceTranscript: "user-intent",
		});
		expect(schema.commands.createArtifact).toMatchObject({
			input: {
				properties: {
					nodes: {
						items: {
							properties: {
								kind: {
									enum: [
										"text",
										"checklist",
										"action",
										"form",
										"table",
										"timeline",
										"chart",
										"code-diff",
										"decision-log",
									],
								},
								text: { type: "string" },
								items: { type: "array", minItems: 1 },
								commandName: {
									enum: ["completeResponse"],
								},
								fields: { type: "array" },
								columns: { type: "array" },
								rows: { type: "array" },
								events: { type: "array" },
								chartType: { enum: ["bar", "line", "pie"] },
								series: { type: "array" },
								before: { type: "string" },
								after: { type: "string" },
								entries: { type: "array" },
							},
						},
					},
				},
			},
		});
		expect(schema.commands.setChecklistItem).toMatchObject({
			input: {
				type: "object",
				required: [
					"artifactId",
					"expectedRevision",
					"nodeId",
					"itemId",
					"checked",
				],
				properties: {
					artifactId: { type: "string", minLength: 1 },
					expectedRevision: { type: "string", minLength: 1 },
					nodeId: { type: "string", minLength: 1 },
					itemId: { type: "string", minLength: 1 },
					checked: { type: "boolean" },
				},
			},
		});
		expect(schema.commands.restoreArtifactRevision).toMatchObject({
			input: {
				type: "object",
				required: ["artifactId", "expectedRevision", "revision"],
			},
		});
		expect(schema.commands.selectArtifact).toMatchObject({
			input: {
				type: "object",
				required: ["artifactId"],
			},
		});
		const initialSnapshot = component.getSnapshot();
		expect(initialSnapshot.matches("preparing")).toBe(true);
		expect(initialSnapshot.context).not.toHaveProperty("phase");
		expect(component.getView()).toMatchObject({
			status: "preparing",
			statusLabel: "Preparing local model",
			canSubmitPrompt: false,
			canRetryModel: false,
			activeArtifact: null,
			resultQuality: null,
			turnCount: 0,
			turnLabel: "0 turns",
			speechStatus: "idle",
			documentSchema: JSON.stringify({ artifacts: [] }, null, 2),
			voiceState: "idle",
			transcript: null,
			transcriptReady: false,
			microphoneUnavailable: false,
			voiceFailure: null,
			turnMessage: "",
			lastFactLabel: "no actor facts yet",
			modelPreparing: true,
			modelFailed: false,
			promptPlaceholder: "Waiting for the local model to finish preparing…",
			turnState: "preparing",
			model: { status: "preparing", failure: null },
			artifacts: [],
			speech: null,
			presentation: {
				artifactView: "document",
				domainPolicy: null,
				runtimePreview: "browser",
				runtimeManifest: [],
				capabilityOutcomes: [],
				draft: "",
				mobilePanel: "conversation",
				speakResponses: true,
				turn: null,
				voice: { type: "voice-idle" },
			},
			runtimeInspector: {
				activeStates: "preparing",
				mlx: {
					status: "preparing",
					ready: false,
					heading: "MLX model readiness",
					statusLabel: "preparing",
					detail: "Prompts remain gated",
				},
				actor: {
					lastFact: null,
					revision: 0,
					heading: "Compound actor state",
					matchText: 'matches("preparing")',
					factLabel: "Current actor fact · no actor facts yet",
				},
				selectedPreview: "browser",
				preview: {
					text: "Browser JSX preview\nNo accepted artifact yet\nno actor facts yet",
					selectors: [
						{ id: "browser", label: "Browser preview", selected: true },
						{ id: "terminal", label: "Terminal preview", selected: false },
						{ id: "speech", label: "Speech preview", selected: false },
						{ id: "headless", label: "Headless preview", selected: false },
					],
				},
				capabilityRows: [
					{
						heading: "No external capability facts yet",
						statusLabel: "waiting",
					},
				],
				domainPolicy: null,
				trace: {
					acceptedArtifactLabel: "Awaiting accepted artifact",
					rows: [
						{
							key: "transcript",
							heading: "Text or speech transcript",
						},
						{
							key: "actor-fact",
							heading: "no actor facts yet",
						},
						{
							key: "artifact",
							heading: "Awaiting accepted artifact",
						},
					],
				},
				receipts: expect.arrayContaining([
					expect.objectContaining({
						id: "terminal",
						detail: "preview only · no remote terminal sync",
					}),
				]),
				schemaExplorer: {
					manifest: {
						heading: "Availability-scoped model manifest",
						countLabel: "0 live commands",
						rows: [
							{
								name: "Awaiting the next model request",
								summaryLabel: "no live commands captured",
							},
						],
					},
					blueprint: {
						heading: "All-component blueprint",
						countLabel: "19 commands from getSchema()",
					},
				},
			},
		});
		expect(component.getView()).not.toHaveProperty("documents");
		expect(component.getView().portRequests.voiceCapture).toBeNull();
		expect(component.getSnapshot().context.presentation).not.toHaveProperty(
			"voiceCaptureRequest",
		);
		recordVoiceCaptureLifecycle({
			state: "transcript",
			attemptId: "voice:1",
			sequence: 1,
			fact: {
				type: "voice-transcript",
				text: "Current final transcript",
				final: true,
			},
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		const voiceIntentSend = vi.spyOn(source, "send");
		await component.execute({ command: "startVoiceCapture" });
		await component.execute({ command: "cancelVoiceCapture" });
		await component.execute({ command: "submitVoiceTranscript" });
		expect(
			voiceIntentSend.mock.calls.slice(-3).map(([event]) => event),
		).toEqual([
			{ type: "VOICE_CAPTURE_START_REQUESTED" },
			{ type: "VOICE_CAPTURE_CANCEL_REQUESTED" },
			{ type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" },
		]);
		voiceIntentSend.mockRestore();
		expect(voiceControlContext(component.getSnapshot())).toMatchObject({
			voiceCaptureControlSequence: 0,
			voiceCaptureControlRequest: null,
		});
		expect(component.getView().portRequests.voiceCapture).toBeNull();
		expect(component.canExecute("submitPrompt")).toBe(false);
		expect(component.canExecute("acknowledgeSpeech")).toBe(false);
		await expect(
			component.execute({
				command: "submitPrompt",
				input: { modality: "text", text: "Too early" },
			}),
		).resolves.toMatchObject({ events: [] });
		expect(component.getSnapshot().context.messages).toEqual([]);
		executePrivatePort({
			command: "recordRuntimeManifest",
			input: [
				{
					name: "createArtifact",
					description: "Create an artifact",
					inputSchema: { type: "object", properties: {} },
					gated: true,
					ownerId: "workbench-component",
				},
			],
		});
		await component.execute({
			command: "selectRuntimePreview",
			input: "terminal",
		});
		for (let index = 0; index < 14; index += 1) {
			executePrivatePort({
				command: "recordCapabilityOutcome",
				input: {
					type: "success",
					ownerId: "web-search",
					toolName: `search-${index}`,
					message: `Search ${index} completed`,
				},
			});
		}
		expect(component.getView().runtimeInspector).toMatchObject({
			activeStates: "preparing",
			mlx: { status: "preparing", ready: false },
			selectedPreview: "terminal",
			preview: {
				text: expect.stringContaining("Preview only · no remote terminal sync"),
			},
			schemaExplorer: {
				manifest: {
					countLabel: "1 live command",
					rows: [
						{
							name: "createArtifact",
							summaryLabel: "workbench-component · live · gated",
						},
					],
				},
			},
		});
		expect(component.getView().runtimeInspector.capabilityRows).toHaveLength(
			12,
		);
		const firstCapabilityRow =
			component.getView().runtimeInspector.capabilityRows[0];
		expect(firstCapabilityRow?.heading).toBe("web-search · search-2");
		executePrivatePort({
			command: "recordCapabilityOutcome",
			input: {
				type: "timeout",
				ownerId: "web-search",
				toolName: "searchWeb",
				message: "Configured fallback timed out.",
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "timeout",
				},
			},
		});
		expect(
			component.getView().runtimeInspector.capabilityRows.slice(-1)[0],
		).toMatchObject({
			statusLabel: "timeout",
			message:
				"Configured fallback timed out. · fallback brave-web-search → fixture-search · trigger HTTP 503 · timeout",
		});
		executePrivatePort({
			command: "recordCapabilityOutcome",
			input: {
				type: "success",
				ownerId: "product-pricing-price",
				toolName: "priceProducts",
				message: "Whole Foods pricing completed.",
				pricingRows: [
					{
						subject: "Bread",
						priceStatus: "sourced",
						product: "365 Organic Sourdough Bread",
						size: "24 oz",
						cacheStatus: "miss",
						nativeStatus: "hit",
						braveStatus: "not-needed",
					},
					{
						subject: "Eggs",
						priceStatus: "unverified",
						reasonCode: "offer-unavailable",
						reason: "The selected offer is not currently available.",
						product: "365 Large Grade A Eggs",
						size: "12 count",
						cacheStatus: "coalesced",
						nativeStatus: "coalesced",
						braveStatus: "coalesced",
					},
					{
						subject: "Milk",
						priceStatus: "unverified",
						reasonCode: "product-not-found",
						reason: "No compatible product was found.",
						cacheStatus: "hit",
						nativeStatus: "not-needed",
						braveStatus: "not-needed",
					},
				],
			},
		});
		const pricingRows = component
			.getView()
			.runtimeInspector.capabilityRows.filter((row) => "subject" in row)
			.slice(-3);
		expect(pricingRows).toEqual([
			{
				key: expect.any(String),
				className: "capability-outcome",
				heading: "Bread · product pricing",
				statusLabel: "sourced · cache miss",
				message:
					"365 Organic Sourdough Bread · 24 oz · native hit · Brave not-needed",
				subject: "Bread",
				priceStatus: "sourced",
				product: "365 Organic Sourdough Bread",
				size: "24 oz",
				cacheStatus: "miss",
				nativeStatus: "hit",
				braveStatus: "not-needed",
			},
			{
				key: expect.any(String),
				className: "capability-outcome",
				heading: "Eggs · product pricing",
				statusLabel: "unverified · cache coalesced",
				message:
					"365 Large Grade A Eggs · 12 count · Current offer unavailable · native coalesced · Brave coalesced",
				subject: "Eggs",
				priceStatus: "unverified",
				reasonCode: "offer-unavailable",
				reason: "The selected offer is not currently available.",
				product: "365 Large Grade A Eggs",
				size: "12 count",
				cacheStatus: "coalesced",
				nativeStatus: "coalesced",
				braveStatus: "coalesced",
			},
			{
				key: expect.any(String),
				className: "capability-outcome",
				heading: "Milk · product pricing",
				statusLabel: "unverified · cache hit",
				message:
					"No selected product · Product not found · native not-needed · Brave not-needed",
				subject: "Milk",
				priceStatus: "unverified",
				reasonCode: "product-not-found",
				reason: "No compatible product was found.",
				cacheStatus: "hit",
				nativeStatus: "not-needed",
				braveStatus: "not-needed",
			},
		]);
		executePrivatePort({
			command: "reportModelFailure",
			input: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		expect(component.getView()).toMatchObject({
			status: "failed",
			statusLabel: "Model unavailable",
			canRetryModel: true,
			canSubmitPrompt: false,
			model: {
				status: "failed",
				failure: { kind: "network" },
			},
			modelPreparing: false,
			modelFailed: true,
			promptPlaceholder: "Retry the local model before sending a prompt…",
		});
		await component.execute({ command: "beginModelPreparation" });
		expect(component.getView()).toMatchObject({
			status: "preparing",
			canRetryModel: false,
			model: { status: "preparing", failure: null },
		});
		executePrivatePort({ command: "reportModelAvailable" });
		expect(component.getView()).toMatchObject({
			status: "ready",
			statusLabel: "Ready",
			canSubmitPrompt: true,
			model: { status: "available", failure: null },
			turnState: "idle",
			runtimeInspector: {
				activeStates: { available: "idle" },
				mlx: { status: "available", ready: true },
			},
		});
		expect(component.canExecute("submitPrompt")).toBe(true);
		expect(component.canExecute("submitVoiceTranscript")).toBe(true);
		expect(
			transcriptCandidateSelector()?.(component.getSnapshot().context),
		).toEqual({ attemptId: "voice:1", text: "Current final transcript" });
		recordVoiceCaptureLifecycle({
			state: "transcript",
			attemptId: "voice:1",
			sequence: 1,
			fact: {
				type: "voice-transcript",
				text: "Interim transcript",
				final: false,
			},
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		expect(
			transcriptCandidateSelector()?.(component.getSnapshot().context),
		).toBeNull();
		recordVoiceCaptureLifecycle({
			state: "transcript",
			attemptId: "voice:1",
			sequence: 1,
			fact: { type: "voice-transcript", text: " ", final: true },
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		expect(
			transcriptCandidateSelector()?.(component.getSnapshot().context),
		).toBeNull();
		recordVoiceCaptureLifecycle({
			state: "transcript",
			attemptId: null,
			sequence: 1,
			fact: {
				type: "voice-transcript",
				text: "Transcript without a current attempt",
				final: true,
			},
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		expect(
			transcriptCandidateSelector()?.(component.getSnapshot().context),
		).toBeNull();
		recordVoiceCaptureLifecycle({
			state: "transcript",
			attemptId: "voice:2",
			sequence: 2,
			fact: {
				type: "voice-transcript",
				text: "Current final transcript",
				final: true,
			},
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(true);
		expect(
			transcriptCandidateSelector()?.(component.getSnapshot().context),
		).toEqual({ attemptId: "voice:2", text: "Current final transcript" });
		recordVoiceCaptureLifecycle({
			state: "idle",
			attemptId: null,
			sequence: 2,
			fact: { type: "voice-idle" },
		});
		expect(component.canExecute("submitVoiceTranscript")).toBe(false);
		source.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: " " },
		});
		expect(component.getSnapshot().matches({ available: "idle" })).toBe(true);
		expect(component.getSnapshot().context.lastFact).toEqual({
			type: "artifact-rejected",
			reason: "validation",
		});
		executePrivatePort({
			command: "recordDomainPolicyDecision",
			input: {
				type: "domain-policy-decision",
				domainId: "product-pricing",
				domainLabel: "Product pricing",
				policyId: "representative-product-selection",
				policyLabel: "Representative product selection",
				outcome: "needs-input",
				summary: "Pricing scope needs clarification.",
				assumptions: [{ id: "bread", label: "Bread uses a 20 oz loaf." }],
				questions: [
					{ id: "location", prompt: "Which retailer location should be used?" },
				],
				evidenceRequirements: [
					{ id: "source", label: "Show the exact source." },
				],
			},
		});
		expect(component.getView().runtimeInspector.domainPolicy).toEqual({
			heading: "Domain policy proof",
			statusLabel: "needs input",
			summary: "Pricing scope needs clarification.",
			identityRows: [
				{ key: "domain", label: "Domain", value: "Product pricing" },
				{
					key: "policy",
					label: "Policy",
					value: "Representative product selection",
				},
			],
			sections: [
				{
					key: "assumptions",
					heading: "Assumptions",
					rows: [{ key: "bread", text: "Bread uses a 20 oz loaf." }],
				},
				{
					key: "questions",
					heading: "Clarification questions",
					rows: [
						{
							key: "location",
							text: "Which retailer location should be used?",
						},
					],
				},
				{
					key: "evidence",
					heading: "Evidence requirements",
					rows: [{ key: "source", text: "Show the exact source." }],
				},
			],
		});
		expect(component.getView().resultQuality).toEqual({
			tone: "needs-input",
			statusLabel: "Needs input",
			heading: "Pricing needs clarification",
			summary: "Pricing scope needs clarification.",
			metrics: [],
			issueRows: [],
			nextActions: ["Answer the clarification questions to continue pricing."],
		});
		expect(component.getView().runtimeInspector.domainPolicyCards).toEqual([
			component.getView().runtimeInspector.domainPolicy,
		]);

		const snapshots = vi.fn();
		const views = vi.fn();
		const snapshotSubscription = component.watchSnapshot(snapshots);
		const viewSubscription = component.watchView(views);
		await component.execute({
			command: "changeDraft",
			input: "Preserve this draft",
		});
		recordVoiceCaptureLifecycle({
			state: "listening",
			attemptId: "voice:listener-proof",
			sequence: 3,
			fact: { type: "voice-listening" },
		});
		expect(component.getView()).toMatchObject({
			presentation: {
				draft: "Preserve this draft",
				voice: { type: "voice-listening" },
			},
			voiceState: "listening",
		});

		(
			await igniteTest(component).when({
				command: "submitPrompt",
				input: { modality: "text", text: "Capture a decision" },
			})
		)
			.expectEvent({
				type: "prompt-submitted",
				turnId: "voice-workbench:1",
				modality: "text",
				text: "Capture a decision",
			})
			.expectView({
				messageCount: 1,
				messages: [
					{
						role: "user",
						channel: "text",
						text: "Capture a decision",
					},
				],
				lastFact: {
					type: "prompt-submitted",
					modality: "text",
					text: "Capture a decision",
				},
				status: "responding",
				statusLabel: "Responding",
				canSubmitPrompt: false,
				turnCount: 1,
				turnLabel: "1 turn",
				turnState: "responding",
				respondingProgress: {
					actorOutcome: "No actor command accepted yet",
					actorOutcomeRecorded: false,
					pendingResult: "Awaiting the first model or capability result",
				},
			});
		expect(component.getView().presentation.domainPolicy).toBeNull();
		expect(component.getSnapshot().matches({ available: "responding" })).toBe(
			true,
		);
		expect(component.canExecute("completeResponse")).toBe(false);
		executePrivatePort({
			command: "reportModelFailure",
			input: {
				kind: "network",
				message: "The model disconnected during the active turn.",
			},
		});
		const failedSnapshot = component.getSnapshot();
		expect(failedSnapshot.value).toBe("unavailable");
		expect(isVoiceWorkbenchKnownForbiddenStateValue(failedSnapshot.value)).toBe(
			false,
		);
		expect(
			voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(failedSnapshot),
		).toBe(true);
		expect(failedSnapshot.context.response).toBeNull();
		expect(failedSnapshot.context.lastFact?.type).toBe("prompt-submitted");
		expect(component.getView()).toMatchObject({
			status: "failed",
			turnState: "unavailable",
			model: { status: "failed" },
			presentation: {
				turn: {
					type: "model-failed",
					failureKind: "network",
					message: "The model disconnected during the active turn.",
					trace: [],
				},
			},
		});
		expect(component.canExecute("createArtifact")).toBe(false);
		expect(component.canExecute("reviseArtifact")).toBe(false);
		expect(component.canExecute("completeResponse")).toBe(false);
		executePrivatePort({ command: "reportModelAvailable" });
		expect(
			voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(
				component.getSnapshot(),
			),
		).toBe(true);
		expect(component.getView()).toMatchObject({
			status: "ready",
			turnState: "idle",
			model: { status: "available" },
		});
		expect(component.getView()).toMatchObject({
			presentation: {
				draft: "Preserve this draft",
				voice: { type: "voice-listening" },
			},
		});
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Capture a decision after recovery" },
		});
		expect(component.getSnapshot().matches({ available: "responding" })).toBe(
			true,
		);

		(
			await igniteTest(component).when({
				command: "createArtifact",
				input: { id: "decision", title: "Decision", nodes },
			})
		)
			.expectEvent({
				type: "artifact-created",
				artifactId: "decision",
				revision: "1",
			})
			.expectView({
				respondingProgress: {
					actorOutcome: "Actor accepted artifact revision 1",
					actorOutcomeRecorded: true,
					pendingResult: "Awaiting the next model or capability result",
				},
				artifacts: [
					{
						id: "decision",
						revision: "1",
						nodes: [
							{ id: "decision-checklist", action: null },
							{ id: "decision-entries", action: null },
							{
								id: "complete-response",
								action: {
									enabled: true,
									input: { text: "Decision captured." },
								},
							},
						],
					},
				],
			});
		expect(component.canExecute("completeResponse")).toBe(true);
		expect(component.canExecute("setChecklistItem")).toBe(true);
		expect(component.getSnapshot().context.documents).toEqual([
			expect.objectContaining({
				id: "decision",
				nodes: expect.arrayContaining([
					expect.objectContaining({
						commandName: "completeResponse",
						payload: { text: "Decision captured." },
					}),
				]),
			}),
		]);
		expect(component.getSnapshot().context.artifactRevisions).toEqual([
			expect.objectContaining({ id: "decision", revision: "1" }),
		]);
		expect(component.getView().modelContext).not.toHaveProperty(
			"artifactRevisions",
		);
		expect(component.getView()).toMatchObject({
			activeArtifact: { id: "decision", revision: "1" },
		});
		expect(component.getView().documentSchema).toContain('"id": "decision"');
		expect(component.canExecute("reviseArtifact")).toBe(true);
		(
			await igniteTest(component).when({
				command: "setChecklistItem",
				input: {
					artifactId: "decision",
					expectedRevision: "1",
					nodeId: "decision-checklist",
					itemId: "verify",
					checked: true,
				},
			})
		).expectEvent({
			type: "artifact-revised",
			artifactId: "decision",
			revision: "2",
		});
		expect(component.getSnapshot().matches({ available: "responding" })).toBe(
			true,
		);
		source.send({
			type: "COMPLETE_RESPONSE",
			input: { text: " " },
		});
		expect(component.getSnapshot().matches({ available: "responding" })).toBe(
			true,
		);
		expect(component.getSnapshot().context.lastFact).toEqual({
			type: "artifact-rejected",
			reason: "validation",
		});

		(
			await igniteTest(component).when({
				command: "reviseArtifact",
				input: {
					artifactId: "decision",
					expectedRevision: "9",
					nodes,
				},
			})
		).expectEvent({ type: "artifact-rejected", reason: "conflict" });
		expect(component.getSnapshot().context.artifactRevisions).toHaveLength(2);

		(
			await igniteTest(component).when({
				command: "completeResponse",
				input: { text: "Decision captured.", speech: "Decision captured." },
			})
		).expectView({ status: "responding", response: null, speech: null });
		const completedTurnId = source.getSnapshot().context.activeTurnId;
		if (!completedTurnId) throw new Error("Expected an active completed turn.");
		recordTurnTerminal({ type: "TURN_COMPLETED", turnId: completedTurnId });
		expect(component.getSnapshot().context.lastFact?.type).toBe(
			"response-completed",
		);
		expect(component.getView().speech).toMatchObject({
			text: "Decision captured.",
			status: "pending",
		});
		expect(component.getView().status).toBe("ready");
		expect(component.canExecute("setChecklistItem")).toBe(true);
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Update the checklist" },
		});
		expect(component.canExecute("setChecklistItem")).toBe(true);
		(
			await igniteTest(component).when({
				command: "setChecklistItem",
				input: {
					artifactId: "decision",
					expectedRevision: "2",
					nodeId: "decision-checklist",
					itemId: "verify",
					checked: false,
				},
			})
		).expectEvent({
			type: "artifact-revised",
			artifactId: "decision",
			revision: "3",
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Decision captured.", speech: "Decision captured." },
		});
		const updatedTurnId = source.getSnapshot().context.activeTurnId;
		if (!updatedTurnId) throw new Error("Expected an active updated turn.");
		recordTurnTerminal({ type: "TURN_COMPLETED", turnId: updatedTurnId });
		expect(component.getView().activeArtifact).toMatchObject({
			id: "decision",
			revision: "3",
		});
		expect(component.getView().activeArtifact?.nodes[0]).toMatchObject({
			id: "decision-checklist",
			items: [{ id: "verify", checked: false }],
		});
		expect(component.getSnapshot().context.artifactRevisions).toHaveLength(3);
		expect(component.getView()).toMatchObject({
			artifactSummaries: [
				{
					id: "decision",
					revision: "3",
					nodeCount: 3,
					active: true,
				},
			],
			activeArtifactRevisions: [
				{ revision: "1", current: false },
				{ revision: "2", current: false },
				{ revision: "3", current: true },
			],
			canRestoreArtifactRevision: true,
		});
		(
			await igniteTest(component).when({
				command: "restoreArtifactRevision",
				input: {
					artifactId: "decision",
					expectedRevision: "3",
					revision: "1",
				},
			})
		).expectEvent({
			type: "artifact-restored",
			artifactId: "decision",
			fromRevision: "1",
			revision: "4",
		});
		(
			await igniteTest(component).when({
				command: "selectArtifact",
				input: { artifactId: "decision" },
			})
		).expectEvent({ type: "artifact-selected", artifactId: "decision" });
		expect(component.canExecute("acknowledgeSpeech")).toBe(true);

		const speech = component.getView().speech;
		expect(speech).not.toBeNull();
		if (!speech) return;
		(
			await igniteTest(component).when({
				command: "acknowledgeSpeech",
				input: { id: speech.id },
			})
		).expectView({ speech: { id: speech.id, status: "acknowledged" } });
		expect(component.canExecute("acknowledgeSpeech")).toBe(false);

		await component.execute({
			command: "submitPrompt",
			input: {
				modality: "text",
				text: "Create a Whole Foods Sarasota shopping list with prices.",
			},
		});
		expect(component.getView()).toMatchObject({
			presentation: {
				capabilityOutcomes: [],
				runtimeManifest: [],
				turn: null,
			},
			resultQuality: null,
		});
		executePrivatePort({
			command: "recordDomainPolicyDecision",
			input: {
				type: "domain-policy-decision",
				domainId: "product-pricing",
				domainLabel: "Product pricing",
				policyId: "category-pricing-scope",
				policyLabel: "Category pricing scope",
				outcome: "admitted",
				summary: "Pricing scope admitted for 3 items.",
				assumptions: [],
				questions: [],
				evidenceRequirements: [
					{ id: "source", label: "Show exact source facts." },
				],
			},
		});
		expect(component.getView().resultQuality).toBeNull();
		executePrivatePort({
			command: "recordCapabilityOutcome",
			input: {
				type: "success",
				ownerId: "product-pricing-price",
				toolName: "priceProducts",
				message: "Whole Foods pricing completed.",
				pricingRows: [
					{
						subject: "Breads",
						priceStatus: "unverified",
						reasonCode: "product-not-found",
						reason: "No compatible product was found.",
						cacheStatus: "miss",
						nativeStatus: "miss",
						braveStatus: "attempted-miss",
					},
					{
						subject: "Eggs",
						priceStatus: "unverified",
						reasonCode: "offer-unavailable",
						reason: "The selected offer is not currently available.",
						product: "365 Large White Grade A Eggs",
						size: "12 count",
						cacheStatus: "miss",
						nativeStatus: "hit",
						braveStatus: "not-needed",
					},
					{
						subject: "Milk",
						priceStatus: "unverified",
						reasonCode: "provider-response-invalid",
						reason: "The provider response could not be decoded.",
						product: "365 Whole Milk",
						size: "1 gallon",
						cacheStatus: "miss",
						nativeStatus: "hit",
						braveStatus: "not-needed",
					},
				],
			},
		});
		await component.execute({
			command: "createArtifact",
			input: {
				id: "shopping-list-wholefoods",
				title: "shopping-list-wholefoods",
				nodes: [
					{
						kind: "table",
						id: "prices",
						columns: [
							{ id: "subject", label: "Subject" },
							{ id: "price", label: "Price" },
							{ id: "status", label: "Status" },
							{ id: "source", label: "Source" },
						],
						rows: [
							{
								id: "breads",
								cells: ["Breads", null, "unverified", null],
							},
							{
								id: "eggs",
								cells: [
									"Eggs",
									null,
									"unverified",
									"https://www.wholefoodsmarket.com/product/eggs",
								],
							},
							{
								id: "milk",
								cells: [
									"Milk",
									null,
									"unverified",
									"https://www.wholefoodsmarket.com/product/milk",
								],
							},
						],
					},
				],
			},
		});
		expect(component.getView()).toMatchObject({
			activeArtifact: {
				id: "shopping-list-wholefoods",
				displayTitle: "Shopping List Whole Foods",
				nodes: [
					{
						id: "prices",
						displayRows: [
							{
								id: "breads",
								cells: [
									{ text: "Breads" },
									{ text: "Price unavailable", tone: "muted" },
									{ text: "Unverified", tone: "warning" },
									{ text: "No source", tone: "muted" },
								],
							},
							{
								id: "eggs",
								cells: expect.arrayContaining([
									{
										text: "wholefoodsmarket.com",
										link: {
											href: "https://www.wholefoodsmarket.com/product/eggs",
											ariaLabel: "Source: wholefoodsmarket.com",
										},
									},
								]),
							},
							{ id: "milk" },
						],
					},
				],
			},
			resultQuality: {
				tone: "warning",
				statusLabel: "Partial result",
				heading: "Shopping list created; prices unavailable",
				summary: "3 requested · 2 products matched · 0 prices verified",
				metrics: [
					{ key: "requested", label: "requested", value: 3 },
					{ key: "matched", label: "matched", value: 2 },
					{ key: "verified", label: "verified", value: 0 },
				],
				issueRows: [
					{ key: "Breads-0", subject: "Breads", label: "Product not found" },
					{
						key: "Eggs-1",
						subject: "Eggs",
						label: "Current offer unavailable",
					},
					{
						key: "Milk-2",
						subject: "Milk",
						label: "Provider response invalid",
					},
				],
				nextActions: [
					"Clarify brand, size, or variety for Breads.",
					"Open matched product pages to confirm current availability and price.",
					"Retry pricing when the provider is available.",
				],
			},
			runtimeInspector: {
				domainPolicy: {
					sections: [
						{
							key: "evidence",
							heading: "Evidence requirements",
							rows: [{ key: "source", text: "Show exact source facts." }],
						},
					],
				},
			},
		});
		expect(component.getView().documentSchema).not.toContain("displayRows");
		executePrivatePort({
			command: "recordCapabilityOutcome",
			input: {
				type: "success",
				ownerId: "product-pricing-price",
				toolName: "priceProducts",
				message: "All prices verified.",
				pricingRows: ["Breads", "Eggs", "Milk"].map((subject) => ({
					subject,
					priceStatus: "sourced" as const,
					product: `${subject} product`,
					size: "1 unit",
					cacheStatus: "hit" as const,
					nativeStatus: "hit" as const,
					braveStatus: "not-needed" as const,
				})),
			},
		});
		expect(component.getView().resultQuality).toMatchObject({
			tone: "success",
			statusLabel: "Complete result",
			heading: "Shopping list prices verified",
			summary: "3 requested · 3 products matched · 3 prices verified",
			issueRows: [],
			nextActions: ["Review verified prices before shopping."],
		});

		expect(snapshots).toHaveBeenCalled();
		expect(views).toHaveBeenCalled();
		expect(component.getSnapshot().context.revision).toBe(
			component.getView().revision,
		);
		snapshotSubscription.unsubscribe();
		viewSubscription.unsubscribe();
		source.stop();
	});
});
