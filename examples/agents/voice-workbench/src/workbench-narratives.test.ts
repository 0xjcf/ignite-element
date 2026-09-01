import { test as igniteTest } from "ignite-element/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelFailureFact } from "./agent-loop";
import type {
	ModelPreparationPortReceipt,
	ModelTurnPortResult,
	SpeechDeliveryPortReceipt,
	VoiceCapturePortReceipt,
	VoiceWorkbenchPorts,
} from "./ports";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import {
	createVoiceWorkbenchComponent,
	type VoiceWorkbenchComponent,
} from "./workbench-component";
import {
	createVoiceWorkbenchRuntime,
	type VoiceWorkbenchRuntime,
} from "./workbench-runtime";

type Deferred<Value> = {
	promise: Promise<Value>;
	resolve: (value: Value) => void;
	reject: (reason?: unknown) => void;
	settled: boolean;
};

const deferred = <Value>(): Deferred<Value> => {
	let resolve!: (value: Value) => void;
	let reject!: (reason?: unknown) => void;
	const state = {
		settled: false,
		promise: new Promise<Value>((resolvePromise, rejectPromise) => {
			resolve = (value) => {
				state.settled = true;
				resolvePromise(value);
			};
			reject = (reason) => {
				state.settled = true;
				rejectPromise(reason);
			};
		}),
		resolve,
		reject,
	};
	return state;
};

type PendingPreparationCall = {
	request: Parameters<VoiceWorkbenchPorts["modelPreparation"]>[0];
	deferred: Deferred<ModelPreparationPortReceipt>;
	signal: AbortSignal;
};

type PendingModelTurnCall = {
	request: Parameters<VoiceWorkbenchPorts["modelTurn"]>[0];
	deferred: Deferred<ModelTurnPortResult>;
};

type ActiveEmitter<Request, Receipt> = {
	request: Request;
	emit: (receipt: Receipt) => void;
	disposed: boolean;
};

type PreparationPlan =
	| { type: "available" }
	| { type: "failed"; failure: ModelFailureFact }
	| null;

type FixtureOptions = {
	input?: Parameters<typeof createVoiceWorkbenchSessionActor>[0];
	initialPreparation?: PreparationPlan;
	modelTurnTimeoutMs?: number;
};

const activeFixtures = new Set<{
	actor: VoiceWorkbenchSessionActor;
	runtime: VoiceWorkbenchRuntime;
}>();

afterEach(() => {
	for (const fixture of activeFixtures) {
		fixture.runtime.dispose();
		fixture.actor.stop();
	}
	activeFixtures.clear();
});

const currentArtifactRevision = (
	actor: VoiceWorkbenchSessionActor,
	artifactId: string,
) =>
	actor
		.getSnapshot()
		.context.documents.find((document) => document.id === artifactId)?.revision;

const commandTrace = (story: {
	trace: Array<{ kind: string; command?: string }>;
}) =>
	story.trace.flatMap((entry) =>
		entry.kind === "command" && entry.command ? [entry.command] : [],
	);

const finalViewStatus = (story: {
	summary: { finalStates: unknown | null };
}): string | null => {
	const view = story.summary.finalStates;
	if (!view || typeof view !== "object" || !("status" in view)) return null;
	return typeof view.status === "string" ? view.status : null;
};

const createFixture = ({
	input,
	initialPreparation = { type: "available" },
	modelTurnTimeoutMs,
}: FixtureOptions = {}) => {
	const actor = createVoiceWorkbenchSessionActor(input).start();
	const component = createVoiceWorkbenchComponent(actor);
	const pendingPreparations: PendingPreparationCall[] = [];
	const pendingModelTurns: PendingModelTurnCall[] = [];
	let activeVoice: ActiveEmitter<
		Parameters<VoiceWorkbenchPorts["voiceCapture"]>[0],
		VoiceCapturePortReceipt
	> | null = null;
	let activeSpeech: ActiveEmitter<
		Parameters<VoiceWorkbenchPorts["speechDelivery"]>[0],
		SpeechDeliveryPortReceipt
	> | null = null;
	let latestTimeout: {
		callback: () => void;
		delayMs: number;
		disposed: boolean;
	} | null = null;
	let nextPreparationPlan = initialPreparation;

	const ports: VoiceWorkbenchPorts = {
		modelPreparation(request, { signal }) {
			const call = {
				request,
				deferred: deferred<ModelPreparationPortReceipt>(),
				signal,
			};
			pendingPreparations.push(call);
			if (nextPreparationPlan) {
				const plan = nextPreparationPlan;
				nextPreparationPlan = null;
				queueMicrotask(() => {
					if (call.deferred.settled) return;
					if (plan.type === "available") {
						call.deferred.resolve({
							type: "available",
							sequence: request.sequence,
						});
						return;
					}
					call.deferred.resolve({
						type: "failed",
						sequence: request.sequence,
						failure: plan.failure,
					});
				});
			}
			return call.deferred.promise;
		},
		modelTurn(request) {
			const call = {
				request,
				deferred: deferred<ModelTurnPortResult>(),
			};
			pendingModelTurns.push(call);
			return call.deferred.promise;
		},
		voiceCapture(request, emit) {
			const effect = { request, emit, disposed: false };
			activeVoice = effect;
			return {
				dispose() {
					effect.disposed = true;
					if (activeVoice === effect) {
						activeVoice = null;
					}
				},
			};
		},
		speechDelivery(request, emit) {
			const effect = { request, emit, disposed: false };
			activeSpeech = effect;
			return {
				dispose() {
					effect.disposed = true;
					if (activeSpeech === effect) {
						activeSpeech = null;
					}
				},
			};
		},
		clock: {
			setTimeout(callback, delayMs) {
				const timeout = {
					callback,
					delayMs,
					disposed: false,
				};
				latestTimeout = timeout;
				return {
					dispose() {
						timeout.disposed = true;
					},
				};
			},
		},
	};

	const runtime = createVoiceWorkbenchRuntime({
		actor,
		ports,
		...(typeof modelTurnTimeoutMs === "number" ? { modelTurnTimeoutMs } : {}),
	});
	activeFixtures.add({ actor, runtime });

	const waitForPreparationCall = async () => {
		await vi.waitFor(() => {
			expect(pendingPreparations.some((call) => !call.deferred.settled)).toBe(
				true,
			);
		});
		const call = pendingPreparations.find((entry) => !entry.deferred.settled);
		if (!call) throw new Error("Expected a pending model preparation call.");
		return call;
	};

	const waitForModelTurnCall = async (
		type?: PendingModelTurnCall["request"]["type"],
	) => {
		await vi.waitFor(() => {
			expect(
				pendingModelTurns.some(
					(call) =>
						!call.deferred.settled &&
						(typeof type === "undefined" || call.request.type === type),
				),
			).toBe(true);
		});
		const call = pendingModelTurns.find(
			(entry) =>
				!entry.deferred.settled &&
				(typeof type === "undefined" || entry.request.type === type),
		);
		if (!call) {
			throw new Error(
				`Expected a pending model-turn call${type ? ` of type ${type}` : ""}.`,
			);
		}
		return call;
	};

	const waitForNextModelTurnCall = async (
		type: PendingModelTurnCall["request"]["type"],
		afterCount: number,
	) => {
		await vi.waitFor(() => {
			expect(
				pendingModelTurns
					.slice(afterCount)
					.some((call) => !call.deferred.settled && call.request.type === type),
			).toBe(true);
		});
		const call = pendingModelTurns
			.slice(afterCount)
			.find((entry) => !entry.deferred.settled && entry.request.type === type);
		if (!call) {
			throw new Error(
				`Expected a model-turn call of type ${type} after index ${afterCount}.`,
			);
		}
		return call;
	};

	const waitForVoiceEmitter = async (
		type?: Parameters<VoiceWorkbenchPorts["voiceCapture"]>[0]["type"],
	) => {
		await vi.waitFor(() => {
			expect(
				Boolean(
					activeVoice &&
						!activeVoice.disposed &&
						(typeof type === "undefined" || activeVoice.request.type === type),
				),
			).toBe(true);
		});
		if (!activeVoice || activeVoice.disposed) {
			throw new Error("Expected an active voice-capture collaborator.");
		}
		return activeVoice;
	};

	const waitForSpeechEmitter = async (
		type?: Parameters<VoiceWorkbenchPorts["speechDelivery"]>[0]["type"],
	) => {
		await vi.waitFor(() => {
			expect(
				Boolean(
					activeSpeech &&
						!activeSpeech.disposed &&
						(typeof type === "undefined" || activeSpeech.request.type === type),
				),
			).toBe(true);
		});
		if (!activeSpeech || activeSpeech.disposed) {
			throw new Error("Expected an active speech-delivery collaborator.");
		}
		return activeSpeech;
	};

	return {
		actor,
		component,
		runtime,
		currentModelRequest: () => {
			const request = actor.getSnapshot().context.portRequests.modelTurn;
			if (!request) throw new Error("Expected a model-turn request.");
			return request;
		},
		currentVoiceRequest: () => {
			const request = actor.getSnapshot().context.portRequests.voiceCapture;
			if (!request) throw new Error("Expected a voice-capture request.");
			return request;
		},
		currentSpeechRequest: () => {
			const request = actor.getSnapshot().context.portRequests.speechDelivery;
			if (!request) throw new Error("Expected a speech-delivery request.");
			return request;
		},
		resolvePreparationAvailable: async () => {
			const call = await waitForPreparationCall();
			call.deferred.resolve({
				type: "available",
				sequence: call.request.sequence,
			});
			return call.request;
		},
		resolvePreparationFailure: async (failure: ModelFailureFact) => {
			const call = await waitForPreparationCall();
			call.deferred.resolve({
				type: "failed",
				sequence: call.request.sequence,
				failure,
			});
			return call.request;
		},
		waitForModelTurnCall,
		waitForNextModelTurnCall,
		modelTurnCallCount: () => pendingModelTurns.length,
		resolveModelTurn: (
			call: PendingModelTurnCall,
			result: ModelTurnPortResult,
		) => {
			call.deferred.resolve(result);
			return call.request;
		},
		resolveModelResult: async (
			text: string,
			speech?: string,
			callId = "story-complete",
		) => {
			const call = await waitForModelTurnCall("request-model");
			call.deferred.resolve({
				receipt: {
					type: "MODEL_RESOLVED",
					turnId: call.request.turnId,
					attemptId: call.request.attemptId,
					result: {
						ok: true,
						calls: [
							{
								id: callId,
								command: "completeResponse",
								input: speech ? { text, speech } : { text },
							},
						],
					},
				},
			});
			return call.request;
		},
		resolveAuthorization: async () => {
			const call = await waitForModelTurnCall("authorize-call");
			call.deferred.resolve({
				receipt: {
					type: "AUTHORIZATION_RESOLVED",
					turnId: call.request.turnId,
					attemptId: call.request.attemptId,
					allowed: true,
				},
			});
			return call.request;
		},
		waitForExecuteCall: async () => {
			const call = await waitForModelTurnCall("execute-call");
			return call;
		},
		emitVoice: async (receipt: VoiceCapturePortReceipt) => {
			const effect = await waitForVoiceEmitter("start");
			effect.emit(receipt);
			return effect.request;
		},
		emitSpeech: async (receipt: SpeechDeliveryPortReceipt) => {
			const effect = await waitForSpeechEmitter("speak");
			effect.emit(receipt);
			return effect.request;
		},
		fireTimeout: () => {
			if (!latestTimeout || latestTimeout.disposed) {
				throw new Error("Expected an active model-turn timeout.");
			}
			latestTimeout.callback();
			return latestTimeout.delayMs;
		},
	};
};

const beginCurrentTurnCompletion = async (
	fixture: ReturnType<typeof createFixture>,
	requestModelCall: PendingModelTurnCall,
	input: { text: string; speech?: string },
) => {
	const authorizeStart = fixture.modelTurnCallCount();
	fixture.resolveModelTurn(requestModelCall, {
		receipt: {
			type: "MODEL_RESOLVED",
			turnId: requestModelCall.request.turnId,
			attemptId: requestModelCall.request.attemptId,
			result: {
				ok: true,
				calls: [
					{
						id: "story-complete",
						command: "completeResponse",
						input: input.speech
							? { text: input.text, speech: input.speech }
							: input,
					},
				],
			},
		},
	});
	const authorizeCall = await fixture.waitForNextModelTurnCall(
		"authorize-call",
		authorizeStart,
	);
	const executeStart = fixture.modelTurnCallCount();
	fixture.resolveModelTurn(authorizeCall, {
		receipt: {
			type: "AUTHORIZATION_RESOLVED",
			turnId: authorizeCall.request.turnId,
			attemptId: authorizeCall.request.attemptId,
			allowed: true,
		},
	});
	return fixture.waitForNextModelTurnCall("execute-call", executeStart);
};

const finishCurrentTurnCompletion = (
	fixture: ReturnType<typeof createFixture>,
	component: VoiceWorkbenchComponent,
	executeCall: Awaited<ReturnType<typeof beginCurrentTurnCompletion>>,
) => {
	if (executeCall.request.type !== "execute-call") {
		throw new Error("Expected an execute-call request.");
	}
	fixture.resolveModelTurn(executeCall, {
		receipt: {
			type: "CAPABILITY_RESOLVED",
			turnId: executeCall.request.turnId,
			attemptId: executeCall.request.attemptId,
			feedback: {
				id: executeCall.request.call.id ?? "story-complete",
				command: executeCall.request.call.command,
				status: "accepted",
				ownerId: "voice-workbench-narratives",
				view: component.getStates().modelContext,
				events: [],
			},
		},
	});
};

describe("voice workbench executable narratives", () => {
	it("dogfoods failure and recovery paths through named stories", async () => {
		const coverageMatrix: Array<{
			narrative: string;
			commands: string[];
			checkpoints: string[];
			receipts: string[];
			finalStatus: unknown;
		}> = [];

		{
			const fixture = createFixture({
				initialPreparation: {
					type: "failed",
					failure: {
						kind: "network",
						message: "The local model could not be reached.",
					},
				},
			});

			const story = await igniteTest({ component: fixture.component }).story(
				"preparation failure retries into ready",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) => snapshot.matches("unavailable"),
						states: { status: "failed", model: { status: "failed" } },
						canExecute: { submitPrompt: false },
					});

					await narrative.intent({ command: "beginModelPreparation" });
					await narrative.behavior(
						"model preparation port becomes available",
						async () => {
							await fixture.resolvePreparationAvailable();
						},
					);

					await narrative.checkpoint("ready after retry", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
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

			expect(story.summary.finalStates).toMatchObject({
				status: "ready",
				model: { status: "available" },
			});
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: ["ready after retry"],
				receipts: [
					"modelPreparation:failed",
					"MODEL_PREPARATION_STARTED",
					"modelPreparation:available",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const fixture = createFixture();

			const story = await igniteTest({ component: fixture.component }).story(
				"microphone permission denial recovers to typed prompt",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
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
					const voiceRequest = fixture.currentVoiceRequest();
					if (
						voiceRequest.type !== "start" ||
						voiceRequest.attemptId === null
					) {
						throw new Error("Expected a correlated voice start request.");
					}
					const voiceAttemptId = voiceRequest.attemptId;
					await narrative.behavior("microphone denies permission", async () => {
						await fixture.emitVoice({
							type: "PERMISSION_DENIED",
							attemptId: voiceAttemptId,
							message: "Microphone access was denied.",
						});
					});

					await narrative.checkpoint("voice permission stays a fact", {
						states: {
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
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						states: {
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

			expect(story.summary.finalStates).toMatchObject({
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
					"voiceCapture:PERMISSION_DENIED",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const fixture = createFixture();

			const story = await igniteTest({ component: fixture.component }).story(
				"correlated cancellation returns the active turn to idle",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: { status: "ready" },
						canExecute: { submitPrompt: true },
					});

					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Cancel this turn." },
					});

					await narrative.checkpoint("turn is responding", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						states: { status: "responding" },
						canExecute: { createArtifact: true },
					});

					const request = fixture.currentModelRequest();
					await narrative.behavior("cancel active turn", async () => {
						fixture.actor.send({
							type: "MODEL_TURN_CANCEL_REQUESTED",
							turnId: request.turnId,
							attemptId: request.attemptId,
						});
					});

					await narrative.checkpoint("turn cancellation returns idle", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "CANCELLED", turnId: request.turnId },
							},
						},
						canExecute: { submitPrompt: true },
					});
				},
			);

			expect(story.summary.finalStates).toMatchObject({ status: "ready" });
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: ["turn is responding", "turn cancellation returns idle"],
				receipts: ["MODEL_TURN_CANCEL_REQUESTED"],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const fixture = createFixture({ modelTurnTimeoutMs: 25 });

			const story = await igniteTest({ component: fixture.component }).story(
				"timed out turn retries to an accepted response",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: { status: "ready" },
						canExecute: { submitPrompt: true },
					});

					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Recover after timeout." },
					});
					await fixture.waitForModelTurnCall("request-model");

					await narrative.behavior(
						"clock fires the active turn timeout",
						async () => {
							expect(fixture.fireTimeout()).toBe(25);
						},
					);

					await narrative.checkpoint("timeout returns the turn to idle", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "TIMEOUT" },
							},
						},
						canExecute: { submitPrompt: true },
					});

					const retryRequestStart = fixture.modelTurnCallCount();
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

					await narrative.checkpoint(
						"retry can finish with an accepted artifact",
						{
							states: {
								status: "responding",
								activeArtifact: {
									id: "timeout-recovery",
									revision: "1",
								},
							},
							canExecute: { completeResponse: true },
						},
					);

					const retryModelCall = await fixture.waitForNextModelTurnCall(
						"request-model",
						retryRequestStart,
					);
					const completion = await beginCurrentTurnCompletion(
						fixture,
						retryModelCall,
						{ text: "Recovered after timeout." },
					);
					await narrative.intent({
						command: "completeResponse",
						input: { text: "Recovered after timeout." },
					});
					await narrative.behavior("model turn accepts the retry", async () => {
						finishCurrentTurnCompletion(fixture, fixture.component, completion);
					});

					await narrative.checkpoint("accepted retry returns to ready", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
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

			expect(story.summary.finalStates).toMatchObject({
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
					"clock:MODEL_TURN_TIMEOUT_REQUESTED",
					"modelTurn:MODEL_RESOLVED",
					"modelTurn:AUTHORIZATION_RESOLVED",
					"modelTurn:CAPABILITY_RESOLVED",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const fixture = createFixture();

			const story = await igniteTest({ component: fixture.component }).story(
				"stale correlated model receipts stay inert until the live turn ends",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: { status: "ready" },
						canExecute: { submitPrompt: true },
					});

					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Ignore stale turn receipts." },
					});

					const staleCall = await fixture.waitForModelTurnCall("request-model");

					await narrative.behavior("cancel the first active turn", async () => {
						fixture.actor.send({
							type: "MODEL_TURN_CANCEL_REQUESTED",
							turnId: staleCall.request.turnId,
							attemptId: staleCall.request.attemptId,
						});
					});

					await narrative.checkpoint("cancelled first turn returns idle", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: {
									type: "CANCELLED",
									turnId: staleCall.request.turnId,
								},
							},
						},
						canExecute: { submitPrompt: true },
					});

					await narrative.intent({
						command: "submitPrompt",
						input: { modality: "text", text: "Live turn stays in control." },
					});

					await narrative.checkpoint("second turn is responding", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						states: {
							status: "responding",
							lifecycle: { lastTurnTerminal: null },
						},
						canExecute: { createArtifact: true },
					});

					await narrative.behavior(
						"late first-turn model result arrives",
						async () => {
							fixture.resolveModelTurn(staleCall, {
								receipt: {
									type: "MODEL_RESOLVED",
									turnId: staleCall.request.turnId,
									attemptId: staleCall.request.attemptId,
									result: { ok: true, calls: [] },
								},
							});
						},
					);

					await narrative.checkpoint("stale port result stays inert", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "responding" } }),
						states: {
							status: "responding",
							lifecycle: { lastTurnTerminal: null },
						},
						canExecute: { createArtifact: true },
					});

					const liveRequest = fixture.currentModelRequest();
					await narrative.behavior("cancel the live turn", async () => {
						fixture.actor.send({
							type: "MODEL_TURN_CANCEL_REQUESTED",
							turnId: liveRequest.turnId,
							attemptId: liveRequest.attemptId,
						});
					});

					await narrative.checkpoint("live correlation still controls exit", {
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: {
									type: "CANCELLED",
									turnId: liveRequest.turnId,
								},
							},
						},
					});
				},
			);

			expect(story.summary.finalStates).toMatchObject({ status: "ready" });
			coverageMatrix.push({
				narrative: story.name,
				commands: commandTrace(story),
				checkpoints: [
					"cancelled first turn returns idle",
					"second turn is responding",
					"stale port result stays inert",
					"live correlation still controls exit",
				],
				receipts: [
					"MODEL_TURN_CANCEL_REQUESTED:first",
					"modelTurn:late-first-result",
					"MODEL_TURN_CANCEL_REQUESTED:live",
				],
				finalStatus: finalViewStatus(story),
			});
		}

		{
			const fixture = createFixture();

			const story = await igniteTest({ component: fixture.component }).story(
				"artifact revision conflicts recover with the current revision",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: { status: "ready" },
						canExecute: { submitPrompt: true },
					});

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
							states: {
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
							states: {
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

					const currentRevision = currentArtifactRevision(
						fixture.actor,
						"launch-plan",
					);
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
						states: {
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

			expect(story.summary.finalStates).toMatchObject({
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
			const fixture = createFixture();

			const story = await igniteTest({ component: fixture.component }).story(
				"speech unavailable remains actor-owned until acknowledged",
				async (narrative) => {
					await narrative.given({
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: { status: "ready" },
						canExecute: { submitPrompt: true },
					});

					const completionRequestStart = fixture.modelTurnCallCount();
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

					const completionModelCall = await fixture.waitForNextModelTurnCall(
						"request-model",
						completionRequestStart,
					);
					const completion = await beginCurrentTurnCompletion(
						fixture,
						completionModelCall,
						{
							text: "Speech fallback stays semantic.",
							speech: "Speech fallback stays semantic.",
						},
					);
					await narrative.intent({
						command: "completeResponse",
						input: {
							text: "Speech fallback stays semantic.",
							speech: "Speech fallback stays semantic.",
						},
					});
					await narrative.behavior(
						"model turn completes with speech output",
						async () => {
							finishCurrentTurnCompletion(
								fixture,
								fixture.component,
								completion,
							);
						},
					);

					await narrative.checkpoint(
						"pending speech stays acknowledged-later",
						{
							when: (snapshot) =>
								snapshot.matches({ available: { speech: "delivering" } }),
							states: {
								status: "ready",
								speech: {
									status: "pending",
									text: "Speech fallback stays semantic.",
								},
							},
							canExecute: { acknowledgeSpeech: true },
						},
					);

					const speechRequest = fixture.currentSpeechRequest();
					await narrative.behavior(
						"speech delivery reports unavailable",
						async () => {
							await fixture.emitSpeech({
								type: "UNAVAILABLE",
								attemptId: speechRequest.attemptId,
							});
						},
					);

					await narrative.checkpoint(
						"speech unavailable settles through the actor",
						{
							states: {
								speech: {
									status: "acknowledged",
									text: "Speech fallback stays semantic.",
								},
								speechStatus: "acknowledged",
								presentation: {
									speechCommit: {
										id: speechRequest.id,
										status: "unavailable",
									},
								},
							},
							canExecute: { acknowledgeSpeech: false },
						},
					);
				},
			);

			expect(story.summary.finalStates).toMatchObject({
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
					"modelTurn:MODEL_RESOLVED",
					"modelTurn:AUTHORIZATION_RESOLVED",
					"modelTurn:CAPABILITY_RESOLVED",
					"speechDelivery:UNAVAILABLE",
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
					"modelPreparation:failed",
					"MODEL_PREPARATION_STARTED",
					"modelPreparation:available",
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
					"voiceCapture:PERMISSION_DENIED",
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
					"clock:MODEL_TURN_TIMEOUT_REQUESTED",
					"modelTurn:MODEL_RESOLVED",
					"modelTurn:AUTHORIZATION_RESOLVED",
					"modelTurn:CAPABILITY_RESOLVED",
				],
				finalStatus: "ready",
			},
			{
				narrative:
					"stale correlated model receipts stay inert until the live turn ends",
				commands: ["submitPrompt", "submitPrompt"],
				checkpoints: [
					"cancelled first turn returns idle",
					"second turn is responding",
					"stale port result stays inert",
					"live correlation still controls exit",
				],
				receipts: [
					"MODEL_TURN_CANCEL_REQUESTED:first",
					"modelTurn:late-first-result",
					"MODEL_TURN_CANCEL_REQUESTED:live",
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
					"modelTurn:MODEL_RESOLVED",
					"modelTurn:AUTHORIZATION_RESOLVED",
					"modelTurn:CAPABILITY_RESOLVED",
					"speechDelivery:UNAVAILABLE",
				],
				finalStatus: "ready",
			},
		]);
	});
});
