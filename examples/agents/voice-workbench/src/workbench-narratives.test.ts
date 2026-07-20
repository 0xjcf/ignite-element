import { test as igniteTest } from "ignite-element/testing";
import { afterEach, describe, expect, it } from "vitest";
import type {
	ModelPreparationPortReceipt,
	ModelTurnPortReceipt,
	SpeechDeliveryPortReceipt,
	VoiceCapturePortReceipt,
} from "./ports";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import {
	createVoiceWorkbenchComponent,
	type VoiceWorkbenchComponent,
} from "./workbench-component";

const activeActors = new Set<VoiceWorkbenchSessionActor>();

afterEach(() => {
	for (const actor of activeActors) actor.stop();
	activeActors.clear();
});

const createFixture = (
	input?: Parameters<typeof createVoiceWorkbenchSessionActor>[0],
) => {
	const actor = createVoiceWorkbenchSessionActor(input).start();
	activeActors.add(actor);
	const component = createVoiceWorkbenchComponent(actor);
	return { actor, component };
};

const currentPreparationRequest = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.modelPreparation;
	if (!request) throw new Error("Expected a model preparation request.");
	return request;
};

const currentModelRequest = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected a model-turn request.");
	return request;
};

const currentVoiceRequest = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.voiceCapture;
	if (!request) throw new Error("Expected a voice-capture request.");
	return request;
};

const currentSpeechRequest = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.speechDelivery;
	if (!request) throw new Error("Expected a speech-delivery request.");
	return request;
};

const reportPreparation = (
	actor: VoiceWorkbenchSessionActor,
	receipt: ModelPreparationPortReceipt,
) => {
	const request = currentPreparationRequest(actor);
	actor.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt,
	});
};

const makeAvailable = (actor: VoiceWorkbenchSessionActor) => {
	reportPreparation(actor, {
		type: "available",
		sequence: currentPreparationRequest(actor).sequence,
	});
};

const sendModelReceipt = (
	actor: VoiceWorkbenchSessionActor,
	receipt: ModelTurnPortReceipt,
) => {
	const request = currentModelRequest(actor);
	actor.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt,
	});
};

const sendVoiceReceipt = (
	actor: VoiceWorkbenchSessionActor,
	receipt: VoiceCapturePortReceipt,
) => {
	const request = currentVoiceRequest(actor);
	actor.send({
		type: "VOICE_CAPTURE_PORT_RECEIVED",
		request,
		receipt,
	});
};

const sendSpeechReceipt = (
	actor: VoiceWorkbenchSessionActor,
	receipt: SpeechDeliveryPortReceipt,
) => {
	const request = currentSpeechRequest(actor);
	actor.send({
		type: "SPEECH_DELIVERY_PORT_RECEIVED",
		request,
		receipt,
	});
};

const currentArtifactRevision = (
	actor: VoiceWorkbenchSessionActor,
	artifactId: string,
) => {
	return actor
		.getSnapshot()
		.context.documents.find((document) => document.id === artifactId)?.revision;
};

const beginCurrentTurnCompletion = (
	actor: VoiceWorkbenchSessionActor,
	input: { text: string; speech?: string },
) => {
	let request = currentModelRequest(actor);
	sendModelReceipt(actor, {
		type: "MODEL_RESOLVED",
		turnId: request.turnId,
		attemptId: request.attemptId,
		result: {
			ok: true,
			calls: [
				{
					id: "narrative-complete",
					command: "completeResponse",
					input,
				},
			],
		},
	});

	request = currentModelRequest(actor);
	sendModelReceipt(actor, {
		type: "AUTHORIZATION_RESOLVED",
		turnId: request.turnId,
		attemptId: request.attemptId,
		allowed: true,
	});

	request = currentModelRequest(actor);
	if (request.type !== "execute-call") {
		throw new Error("Expected an execute-call request.");
	}

	return {
		turnId: request.turnId,
		attemptId: request.attemptId,
		callId: request.call.id ?? "narrative-complete",
		command: request.call.command,
	};
};

const finishCurrentTurnCompletion = (
	actor: VoiceWorkbenchSessionActor,
	component: VoiceWorkbenchComponent,
	completion: ReturnType<typeof beginCurrentTurnCompletion>,
) => {
	sendModelReceipt(actor, {
		type: "CAPABILITY_RESOLVED",
		turnId: completion.turnId,
		attemptId: completion.attemptId,
		feedback: {
			id: completion.callId,
			command: completion.command,
			status: "accepted",
			ownerId: "voice-workbench-narratives",
			view: component.getView().modelContext,
			events: [],
		},
	});
};

const commandTrace = (story: {
	trace: Array<{ kind: string; command?: string }>;
}) =>
	story.trace.flatMap((entry) =>
		entry.kind === "command" && entry.command ? [entry.command] : [],
	);

const finalViewStatus = (story: {
	summary: { finalView: unknown | null };
}): string | null => {
	const view = story.summary.finalView;
	if (!view || typeof view !== "object" || !("status" in view)) return null;
	return typeof view.status === "string" ? view.status : null;
};

describe("voice workbench executable narratives", () => {
	it("dogfoods failure and recovery paths through named narratives", async () => {
		const coverageMatrix: Array<{
			narrative: string;
			commands: string[];
			checkpoints: string[];
			receipts: string[];
			finalStatus: unknown;
		}> = [];

		{
			const { actor, component } = createFixture();
			reportPreparation(actor, {
				type: "failed",
				sequence: currentPreparationRequest(actor).sequence,
				failure: {
					kind: "network",
					message: "The local model could not be reached.",
				},
			});

			const story = await igniteTest({ component }).story(
				"preparation failure retries into ready",
				async (narrative) => {
					await narrative.given({
						snapshot: (snapshot) => snapshot.matches("unavailable"),
						view: { status: "failed", model: { status: "failed" } },
						canExecute: { submitPrompt: false },
					});

					await narrative.intent({ command: "beginModelPreparation" });
					await narrative.behavior("model preparation becomes available", async () => {
						reportPreparation(actor, {
							type: "available",
							sequence: currentPreparationRequest(actor).sequence,
						});
					});

					await narrative.checkpoint("ready after retry", {
						snapshot: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							model: { status: "available" },
							statusLabel: "Ready",
						},
						canExecute: {
							submitPrompt: true,
							startVoiceCapture: true,
						},
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({
				status: "ready",
				model: { status: "available" },
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: ["ready after retry"],
				receipts: [
					"MODEL_PREPARATION_PORT_RECEIVED:failed",
					"MODEL_PREPARATION_STARTED",
					"MODEL_PREPARATION_PORT_RECEIVED:available",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"microphone permission denial recovers to typed prompt",
				async (narrative) => {
					await narrative.given({
						snapshot: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							voiceState: "idle",
						},
						canExecute: {
							startVoiceCapture: true,
							submitPrompt: true,
							submitVoiceTranscript: false,
						},
					});

					await narrative.intent({ command: "startVoiceCapture" });
					const request = currentVoiceRequest(actor);
					if (request.type !== "start" || request.attemptId === null) {
						throw new Error("Expected a correlated voice start request.");
					}
					await narrative.behavior("microphone permission denied", async () => {
						sendVoiceReceipt(actor, {
							type: "PERMISSION_DENIED",
							attemptId: request.attemptId,
							message: "Microphone access was denied.",
						});
					});

					await narrative.checkpoint("voice permission stays a fact", {
						view: {
							voiceState: "permission",
							voiceFailure: {
								type: "voice-permission-denied",
								message: "Microphone access was denied.",
							},
						},
						canExecute: {
							startVoiceCapture: true,
							submitPrompt: true,
							submitVoiceTranscript: false,
						},
					});

					await narrative.intent({
						command: "submitPrompt",
						input: {
							modality: "text",
							text: "Continue with text fallback.",
						},
					});

					await narrative.checkpoint("text recovery starts a new turn", {
						snapshot: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						view: {
							status: "responding",
							lastFact: {
								type: "prompt-submitted",
								modality: "text",
								text: "Continue with text fallback.",
							},
						},
						canExecute: {
							createArtifact: true,
							completeResponse: false,
						},
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({
				status: "responding",
				voiceState: "permission",
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"voice permission stays a fact",
					"text recovery starts a new turn",
				],
				receipts: [
					"VOICE_CAPTURE_START_REQUESTED",
					"VOICE_CAPTURE_PORT_RECEIVED:PERMISSION_DENIED",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"correlated cancellation returns the active turn to idle",
				async (narrative) => {
					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Cancel this turn." },
					});

					await narrative.checkpoint("turn is responding", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						view: { status: "responding" },
						canExecute: { createArtifact: true },
					});

					const request = currentModelRequest(actor);
					await narrative.behavior("cancel active turn", async () => {
						actor.send({
							type: "MODEL_TURN_CANCEL_REQUESTED",
							turnId: request.turnId,
							attemptId: request.attemptId,
						});
					});

					await narrative.checkpoint("turn cancellation returns idle", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "CANCELLED", turnId: request.turnId },
							},
						},
						canExecute: { submitPrompt: true },
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({ status: "ready" });
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: ["turn is responding", "turn cancellation returns idle"],
				receipts: ["MODEL_TURN_CANCEL_REQUESTED"],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"timed out turn retries to an accepted response",
				async (narrative) => {
					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Recover after timeout." },
					});

					let request = currentModelRequest(actor);
					await narrative.behavior("timeout active turn", async () => {
						actor.send({
							type: "MODEL_TURN_TIMEOUT_REQUESTED",
							turnId: request.turnId,
							attemptId: request.attemptId,
						});
					});

					await narrative.checkpoint("timeout returns the turn to idle", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "TIMEOUT", turnId: request.turnId },
							},
						},
						canExecute: { submitPrompt: true },
					});

					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Retry after timeout." },
					});
					await narrative.intent({
						command: "createArtifact",
						input: {
							id: "timeout-recovery",
							title: "Timeout recovery",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "Recovery document",
								},
							],
						},
					});

					await narrative.checkpoint("retry can finish with an accepted artifact", {
						view: {
							status: "responding",
							activeArtifact: {
								id: "timeout-recovery",
								revision: "1",
							},
						},
						canExecute: { completeResponse: true },
					});

					const completion = beginCurrentTurnCompletion(actor, {
						text: "Recovered after timeout.",
					});
					await narrative.intent({
						command: "completeResponse",
						input: { text: "Recovered after timeout." },
					});
					await narrative.behavior("finish accepted retry", async () => {
						finishCurrentTurnCompletion(actor, component, completion);
					});

					await narrative.checkpoint("accepted retry returns to ready", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							response: { text: "Recovered after timeout." },
							activeArtifact: {
								id: "timeout-recovery",
								revision: "1",
							},
						},
						canExecute: { submitPrompt: true },
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({
				status: "ready",
				response: { text: "Recovered after timeout." },
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"timeout returns the turn to idle",
					"retry can finish with an accepted artifact",
					"accepted retry returns to ready",
				],
				receipts: [
					"MODEL_TURN_TIMEOUT_REQUESTED",
					"MODEL_TURN_PORT_RECEIVED:MODEL_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:AUTHORIZATION_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:CAPABILITY_RESOLVED",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"stale correlated model receipts stay inert until the live turn ends",
				async (narrative) => {
					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Ignore stale turn receipts." },
					});

					const request = currentModelRequest(actor);
					await narrative.behavior("send stale model receipt", async () => {
						actor.send({
							type: "MODEL_TURN_PORT_RECEIVED",
							request,
							receipt: {
								type: "PORT_FAILED",
								turnId: request.turnId,
								attemptId: `${request.attemptId}:stale`,
								failure: { kind: "provider", message: "stale" },
							},
						});
					});

					await narrative.checkpoint("stale receipt cannot close the turn", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						view: {
							status: "responding",
							lifecycle: { lastTurnTerminal: null },
						},
						canExecute: { createArtifact: true },
					});

					await narrative.behavior("cancel live turn", async () => {
						actor.send({
							type: "MODEL_TURN_CANCEL_REQUESTED",
							turnId: request.turnId,
							attemptId: request.attemptId,
						});
					});

					await narrative.checkpoint("live correlation still controls exit", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						view: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "CANCELLED", turnId: request.turnId },
							},
						},
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({ status: "ready" });
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"stale receipt cannot close the turn",
					"live correlation still controls exit",
				],
				receipts: [
					"MODEL_TURN_PORT_RECEIVED:PORT_FAILED(stale)",
					"MODEL_TURN_CANCEL_REQUESTED",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"artifact revision conflicts recover with the current revision",
				async (narrative) => {
					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Revise this artifact." },
					});
					await narrative.intent({
						command: "createArtifact",
						input: {
							id: "launch-plan",
							title: "Launch plan",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "Revision one",
								},
							],
						},
					});

					await narrative.checkpoint(
						"first revision is available for follow-up work",
						{
							view: {
								activeArtifact: {
									id: "launch-plan",
									revision: "1",
								},
							},
							canExecute: {
								reviseArtifact: true,
								completeResponse: true,
							},
						},
					);

					await narrative.intent({
						command: "reviseArtifact",
						input: {
							artifactId: "launch-plan",
							expectedRevision: "0",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "This stale revision must be rejected.",
								},
							],
						},
					});

					await narrative.checkpoint(
						"stale revision preserves the accepted artifact",
						{
							view: {
								activeArtifact: {
									id: "launch-plan",
									revision: "1",
								},
							},
							canExecute: {
								reviseArtifact: true,
								completeResponse: true,
							},
						},
					);

					const currentRevision = currentArtifactRevision(actor, "launch-plan");
					if (!currentRevision) throw new Error("Expected a current revision.");

					await narrative.intent({
						command: "reviseArtifact",
						input: {
							artifactId: "launch-plan",
							expectedRevision: currentRevision,
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "Revision two",
								},
							],
						},
					});

					await narrative.checkpoint("current revision recovers the conflict", {
						view: {
							activeArtifact: {
								id: "launch-plan",
								revision: "2",
							},
						},
						canExecute: {
							reviseArtifact: true,
							completeResponse: true,
						},
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({
				activeArtifact: { id: "launch-plan", revision: "2" },
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"first revision is available for follow-up work",
					"stale revision preserves the accepted artifact",
					"current revision recovers the conflict",
				],
				receipts: [
					"actor-conflict:reviseArtifact",
					"actor-accepted:reviseArtifact",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const { actor, component } = createFixture();
			makeAvailable(actor);

			const story = await igniteTest({ component }).story(
				"speech unavailable remains actor-owned until acknowledged",
				async (narrative) => {
					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Speak this response." },
					});
					await narrative.intent({
						command: "createArtifact",
						input: {
							id: "speech-proof",
							title: "Speech proof",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "Speech fallback stays semantic.",
								},
							],
						},
					});

					const completion = beginCurrentTurnCompletion(actor, {
						text: "Speech fallback stays semantic.",
						speech: "Speech fallback stays semantic.",
					});
					await narrative.intent({
						command: "completeResponse",
						input: {
							text: "Speech fallback stays semantic.",
							speech: "Speech fallback stays semantic.",
						},
					});
					await narrative.behavior("finish speech completion", async () => {
						finishCurrentTurnCompletion(actor, component, completion);
					});

					await narrative.checkpoint("pending speech stays acknowledged-later", {
						when: (snapshot) =>
							snapshot.matches({ available: { speech: "delivering" } }),
						view: {
							status: "ready",
							speech: {
								status: "pending",
								text: "Speech fallback stays semantic.",
							},
						},
						canExecute: { acknowledgeSpeech: true },
					});

					const request = currentSpeechRequest(actor);
					await narrative.behavior("speech becomes unavailable", async () => {
						sendSpeechReceipt(actor, {
							type: "UNAVAILABLE",
							attemptId: request.attemptId,
						});
					});

					await narrative.checkpoint("speech unavailable settles through the actor", {
						view: {
							speech: {
								status: "acknowledged",
								text: "Speech fallback stays semantic.",
							},
							speechStatus: "acknowledged",
							presentation: {
								speechCommit: {
									id: request.id,
									status: "unavailable",
								},
							},
						},
						canExecute: { acknowledgeSpeech: false },
					});
				},
			);

			expect(story.summary.finalView).toMatchObject({
				speech: {
					status: "acknowledged",
					text: "Speech fallback stays semantic.",
				},
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"pending speech stays acknowledged-later",
					"speech unavailable settles through the actor",
				],
				receipts: [
					"MODEL_TURN_PORT_RECEIVED:MODEL_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:AUTHORIZATION_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:CAPABILITY_RESOLVED",
					"SPEECH_DELIVERY_PORT_RECEIVED:UNAVAILABLE",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		expect(
			coverageMatrix.map((entry) => ({
				narrative: entry.narrative,
				commands: entry.commands,
				checkpoints: entry.checkpoints,
				receipts: entry.receipts,
				finalStatus: entry.finalStatus,
			})),
		).toEqual([
			{
				narrative: "preparation failure retries into ready",
				commands: ["beginModelPreparation"],
				checkpoints: ["ready after retry"],
				receipts: [
					"MODEL_PREPARATION_PORT_RECEIVED:failed",
					"MODEL_PREPARATION_STARTED",
					"MODEL_PREPARATION_PORT_RECEIVED:available",
				],
				finalStatus: "ready",
			},
			{
				narrative: "microphone permission denial recovers to typed prompt",
				commands: ["startVoiceCapture", "submitPrompt"],
				checkpoints: [
					"voice permission stays a fact",
					"text recovery starts a new turn",
				],
				receipts: [
					"VOICE_CAPTURE_START_REQUESTED",
					"VOICE_CAPTURE_PORT_RECEIVED:PERMISSION_DENIED",
				],
				finalStatus: "responding",
			},
			{
				narrative: "correlated cancellation returns the active turn to idle",
				commands: ["submitPrompt"],
				checkpoints: ["turn is responding", "turn cancellation returns idle"],
				receipts: ["MODEL_TURN_CANCEL_REQUESTED"],
				finalStatus: "ready",
			},
			{
				narrative: "timed out turn retries to an accepted response",
				commands: [
					"submitPrompt",
					"submitPrompt",
					"createArtifact",
					"completeResponse",
				],
				checkpoints: [
					"timeout returns the turn to idle",
					"retry can finish with an accepted artifact",
					"accepted retry returns to ready",
				],
				receipts: [
					"MODEL_TURN_TIMEOUT_REQUESTED",
					"MODEL_TURN_PORT_RECEIVED:MODEL_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:AUTHORIZATION_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:CAPABILITY_RESOLVED",
				],
				finalStatus: "ready",
			},
			{
				narrative:
					"stale correlated model receipts stay inert until the live turn ends",
				commands: ["submitPrompt"],
				checkpoints: [
					"stale receipt cannot close the turn",
					"live correlation still controls exit",
				],
				receipts: [
					"MODEL_TURN_PORT_RECEIVED:PORT_FAILED(stale)",
					"MODEL_TURN_CANCEL_REQUESTED",
				],
				finalStatus: "ready",
			},
			{
				narrative:
					"artifact revision conflicts recover with the current revision",
				commands: [
					"submitPrompt",
					"createArtifact",
					"reviseArtifact",
					"reviseArtifact",
				],
				checkpoints: [
					"first revision is available for follow-up work",
					"stale revision preserves the accepted artifact",
					"current revision recovers the conflict",
				],
				receipts: [
					"actor-conflict:reviseArtifact",
					"actor-accepted:reviseArtifact",
				],
				finalStatus: "responding",
			},
			{
				narrative: "speech unavailable remains actor-owned until acknowledged",
				commands: ["submitPrompt", "createArtifact", "completeResponse"],
				checkpoints: [
					"pending speech stays acknowledged-later",
					"speech unavailable settles through the actor",
				],
				receipts: [
					"MODEL_TURN_PORT_RECEIVED:MODEL_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:AUTHORIZATION_RESOLVED",
					"MODEL_TURN_PORT_RECEIVED:CAPABILITY_RESOLVED",
					"SPEECH_DELIVERY_PORT_RECEIVED:UNAVAILABLE",
				],
				finalStatus: "ready",
			},
		]);
	});
});
