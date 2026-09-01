import { test as igniteTest } from "ignite-element/xstate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import {
	createTestModel,
	getPathsFromEvents,
	getShortestPaths,
	getSimplePaths,
} from "xstate/graph";
import type { ModelTurnPortResult } from "./ports";
import {
	createVoiceWorkbenchSessionActor,
	isVoiceWorkbenchKnownForbiddenStateValue,
	type VoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionEvent,
	type VoiceWorkbenchSessionSnapshot,
	type VoiceWorkbenchSessionStateValue,
	voiceWorkbenchKnownForbiddenStateValues,
	voiceWorkbenchSessionInvariants,
	voiceWorkbenchSessionMachine,
} from "./session";
import { createVoiceWorkbenchComponent } from "./workbench-component";
import { createVoiceWorkbenchRuntime } from "./workbench-runtime";

const preparationRequest1 = { type: "prepare-model", sequence: 1 } as const;
const preparationAvailable1 = {
	type: "MODEL_PREPARATION_PORT_RECEIVED",
	request: preparationRequest1,
	receipt: { type: "available", sequence: 1 },
} as const satisfies VoiceWorkbenchSessionEvent;
const preparationFailed1 = {
	type: "MODEL_PREPARATION_PORT_RECEIVED",
	request: preparationRequest1,
	receipt: {
		type: "failed",
		sequence: 1,
		failure: { kind: "network", message: "Graph preparation failed." },
	},
} as const satisfies VoiceWorkbenchSessionEvent;
const preparationStarted = {
	type: "MODEL_PREPARATION_STARTED",
} as const satisfies VoiceWorkbenchSessionEvent;
const preparationAvailable2 = {
	type: "MODEL_PREPARATION_PORT_RECEIVED",
	request: { type: "prepare-model", sequence: 2 },
	receipt: { type: "available", sequence: 2 },
} as const satisfies VoiceWorkbenchSessionEvent;
const submitPrompt = {
	type: "SUBMIT_PROMPT",
	input: {
		modality: "text",
		text: "Characterize the parent-supervised graph.",
	},
} as const satisfies VoiceWorkbenchSessionEvent;
const timeoutTurn = {
	type: "MODEL_TURN_TIMEOUT_REQUESTED",
	turnId: "voice-workbench:1",
	attemptId: "voice-workbench:1:1",
} as const satisfies VoiceWorkbenchSessionEvent;

const graphEvents = [
	preparationAvailable1,
	preparationFailed1,
	preparationStarted,
	preparationAvailable2,
	submitPrompt,
	timeoutTurn,
] as const satisfies readonly VoiceWorkbenchSessionEvent[];

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

type PendingModelTurnCall = {
	request: { type: string; turnId: string; attemptId: string };
	deferred: Deferred<ModelTurnPortResult>;
};

const activeFixtures = new Set<{
	actor: ReturnType<typeof createVoiceWorkbenchSessionActor>;
	runtime: ReturnType<typeof createVoiceWorkbenchRuntime>;
}>();

afterEach(() => {
	for (const fixture of activeFixtures) {
		fixture.runtime.dispose();
		fixture.actor.stop();
	}
	activeFixtures.clear();
});

type GraphEventDisposition =
	| "traversed"
	| "context-cycle"
	| "private-port"
	| "projection-only";

// Adding a machine event creates a compile-time graph-policy review point.
const graphEventPolicy = {
	SUBMIT_PROMPT: "traversed",
	CREATE_ARTIFACT: "context-cycle",
	REVISE_ARTIFACT: "context-cycle",
	RESTORE_ARTIFACT_REVISION: "context-cycle",
	SELECT_ARTIFACT: "context-cycle",
	SET_CHECKLIST_ITEM: "context-cycle",
	COMPLETE_RESPONSE: "context-cycle",
	ACKNOWLEDGE_SPEECH: "context-cycle",
	MODEL_PREPARATION_STARTED: "traversed",
	MODEL_PREPARATION_PORT_RECEIVED: "traversed",
	MODEL_TURN_PORT_RECEIVED: "private-port",
	VOICE_CAPTURE_PORT_RECEIVED: "private-port",
	SPEECH_DELIVERY_PORT_RECEIVED: "private-port",
	MODEL_TURN_TIMEOUT_REQUESTED: "traversed",
	MODEL_TURN_CANCEL_REQUESTED: "private-port",
	VOICE_CAPTURE_START_REQUESTED: "context-cycle",
	VOICE_CAPTURE_CANCEL_REQUESTED: "context-cycle",
	VOICE_TRANSCRIPT_SUBMIT_REQUESTED: "context-cycle",
	SPEECH_DELIVERY_REPLAY_REQUESTED: "context-cycle",
	PRESENTATION_UPDATED: "projection-only",
	DOCUMENT_COMMITTED: "private-port",
	CAPABILITY_OUTCOME_RECORDED: "private-port",
	DOMAIN_POLICY_RECORDED: "private-port",
	RUNTIME_MANIFEST_RECORDED: "private-port",
	TURN_RECORDED: "private-port",
} as const satisfies Record<
	VoiceWorkbenchSessionEvent["type"],
	GraphEventDisposition
>;

const readStateValue = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): VoiceWorkbenchSessionStateValue => {
	const value = snapshot.value;
	if (value === "preparing" || value === "unavailable") return value;
	if (
		typeof value === "object" &&
		value !== null &&
		"available" in value &&
		typeof value.available === "object" &&
		value.available !== null &&
		(value.available.turn === "idle" ||
			value.available.turn === "responding") &&
		value.available.voice === "active" &&
		(value.available.speech === "idle" ||
			value.available.speech === "delivering")
	) {
		return {
			available: {
				turn: value.available.turn,
				voice: value.available.voice,
				speech: value.available.speech,
			},
		};
	}
	throw new Error(`Unexpected state value: ${JSON.stringify(value)}`);
};

const traversalOptions = {
	events: graphEvents,
	filterEvents: (
		_snapshot: VoiceWorkbenchSessionSnapshot,
		event: VoiceWorkbenchSessionEvent,
	) => graphEventPolicy[event.type] === "traversed",
	limit: 128,
	serializeEvent: (event: VoiceWorkbenchSessionEvent) => JSON.stringify(event),
	serializeState: (snapshot: VoiceWorkbenchSessionSnapshot) =>
		JSON.stringify(readStateValue(snapshot)),
	stopWhen: () => false,
};

const makeAvailable = (actor: VoiceWorkbenchSessionActor) => {
	actor.send(preparationAvailable1);
};

const serializeStateValue = (snapshot: VoiceWorkbenchSessionSnapshot) =>
	JSON.stringify(readStateValue(snapshot));

const createGraphFixture = () => {
	const actor = createVoiceWorkbenchSessionActor().start();
	const component = createVoiceWorkbenchComponent(actor);
	const pendingModelTurns: PendingModelTurnCall[] = [];
	let latestTimeout: {
		callback: () => void;
		delayMs: number;
		disposed: boolean;
	} | null = null;

	const runtime = createVoiceWorkbenchRuntime({
		actor,
		modelTurnTimeoutMs: 25,
		ports: {
			modelPreparation(request) {
				return Promise.resolve({
					type: "available" as const,
					sequence: request.sequence,
				});
			},
			modelTurn(request) {
				const call = {
					request,
					deferred: deferred<ModelTurnPortResult>(),
				};
				pendingModelTurns.push(call);
				return call.deferred.promise;
			},
			voiceCapture() {
				return { dispose() {} };
			},
			speechDelivery() {
				return { dispose() {} };
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
		},
	});
	activeFixtures.add({ actor, runtime });

	return {
		actor,
		component,
		waitForModelTurnCall: async () => {
			await vi.waitFor(() => {
				expect(
					pendingModelTurns.some(
						(call) =>
							!call.deferred.settled && call.request.type === "request-model",
					),
				).toBe(true);
			});
			const call = pendingModelTurns.find(
				(entry) =>
					!entry.deferred.settled && entry.request.type === "request-model",
			);
			if (!call) throw new Error("Expected a pending model-turn request.");
			return call;
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

describe("voice workbench XState graph characterization", () => {
	it("declares the compound parallel topology and fixed child ownership", () => {
		const states = voiceWorkbenchSessionMachine.config.states;
		expect(Object.keys(states ?? {})).toEqual([
			"preparing",
			"unavailable",
			"available",
		]);
		const available = states?.available;
		expect(available?.type).toBe("parallel");
		expect(Object.keys(available?.states ?? {})).toEqual([
			"turn",
			"voice",
			"speech",
		]);
		expect(available?.states?.turn?.states?.responding?.invoke).toMatchObject({
			id: "model-turn",
		});
		expect(available?.states?.voice?.states?.active?.invoke).toMatchObject({
			id: "voice-capture",
		});
		expect(available?.states?.speech?.states?.delivering?.invoke).toMatchObject(
			{
				id: "speech-delivery",
			},
		);
	});

	it("uses graph traversal to reach every deterministic lifecycle vertex", () => {
		const shortest = getShortestPaths(
			voiceWorkbenchSessionMachine,
			traversalOptions,
		);
		const simple = getSimplePaths(
			voiceWorkbenchSessionMachine,
			traversalOptions,
		);
		const expected = new Set([
			JSON.stringify("preparing"),
			JSON.stringify("unavailable"),
			JSON.stringify({
				available: { turn: "idle", voice: "active", speech: "idle" },
			}),
			JSON.stringify({
				available: {
					turn: "responding",
					voice: "active",
					speech: "idle",
				},
			}),
		]);

		expect(
			new Set(
				shortest.map((path) => JSON.stringify(readStateValue(path.state))),
			),
		).toEqual(expected);
		expect(
			new Set(simple.map((path) => JSON.stringify(readStateValue(path.state)))),
		).toEqual(expected);
		expect(shortest.length).toBeLessThanOrEqual(simple.length);
		for (const path of shortest) {
			const simpleMatch = simple.find(
				(candidate) =>
					serializeStateValue(candidate.state) ===
					serializeStateValue(path.state),
			);
			expect(simpleMatch).toBeDefined();
			expect(path.steps.length).toBeLessThanOrEqual(
				simpleMatch?.steps.length ?? 0,
			);
		}
	});

	it("has zero forbidden reachable snapshots", () => {
		const paths = getShortestPaths(
			voiceWorkbenchSessionMachine,
			traversalOptions,
		);
		expect(voiceWorkbenchKnownForbiddenStateValues).toEqual([]);
		for (const { state } of paths) {
			expect(isVoiceWorkbenchKnownForbiddenStateValue(state.value)).toBe(false);
			expect(
				voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(state),
			).toBe(true);
			expect(
				voiceWorkbenchSessionInvariants.respondingRequiresAvailable(state),
			).toBe(true);
		}
	});

	it("fences stale preparation receipts across retry", () => {
		const actor = createActor(voiceWorkbenchSessionMachine, {
			input: undefined,
		}).start();
		actor.send(preparationFailed1);
		expect(actor.getSnapshot().value).toBe("unavailable");
		actor.send(preparationStarted);
		expect(actor.getSnapshot().value).toBe("preparing");
		expect(
			actor.getSnapshot().context.portRequests.modelPreparation?.sequence,
		).toBe(2);

		actor.send(preparationAvailable1);
		expect(actor.getSnapshot().value).toBe("preparing");
		actor.send(preparationAvailable2);
		expect(actor.getSnapshot().matches("available")).toBe(true);
		actor.stop();
	});

	it("returns timeout and failure child outputs to idle without direct terminal events", () => {
		const timeoutActor = createActor(voiceWorkbenchSessionMachine, {
			input: undefined,
		}).start();
		makeAvailable(timeoutActor);
		timeoutActor.send(submitPrompt);
		const timeoutRequest =
			timeoutActor.getSnapshot().context.portRequests.modelTurn;
		if (!timeoutRequest) throw new Error("Expected a model-turn request.");
		timeoutActor.send({
			type: "MODEL_TURN_TIMEOUT_REQUESTED",
			turnId: timeoutRequest.turnId,
			attemptId: timeoutRequest.attemptId,
		});
		expect(
			timeoutActor.getSnapshot().matches({ available: { turn: "idle" } }),
		).toBe(true);
		expect(timeoutActor.getSnapshot().context.lastTurnTerminal).toEqual({
			type: "TIMEOUT",
			turnId: timeoutRequest.turnId,
		});
		timeoutActor.stop();

		const failedActor = createActor(voiceWorkbenchSessionMachine, {
			input: undefined,
		}).start();
		makeAvailable(failedActor);
		failedActor.send(submitPrompt);
		const failureRequest =
			failedActor.getSnapshot().context.portRequests.modelTurn;
		if (!failureRequest) throw new Error("Expected a model-turn request.");
		failedActor.send({
			type: "MODEL_TURN_PORT_RECEIVED",
			request: failureRequest,
			receipt: {
				type: "PORT_FAILED",
				turnId: failureRequest.turnId,
				attemptId: failureRequest.attemptId,
				failure: { kind: "provider", message: "Graph model port failed." },
			},
		});
		expect(
			failedActor.getSnapshot().matches({ available: { turn: "idle" } }),
		).toBe(true);
		expect(failedActor.getSnapshot().context.lastTurnTerminal).toMatchObject({
			type: "TURN_FAILED",
			turnId: failureRequest.turnId,
		});
		expect(failedActor.getSnapshot().context.presentation.turn).toMatchObject({
			type: "model-failed",
			failureKind: "provider",
		});
		failedActor.stop();
	});

	it("starts a fresh supervised child after timeout and ignores stale follow-up receipts", () => {
		const actor = createActor(voiceWorkbenchSessionMachine, {
			input: undefined,
		}).start();
		makeAvailable(actor);
		actor.send(submitPrompt);
		const firstRequest = actor.getSnapshot().context.portRequests.modelTurn;
		if (!firstRequest)
			throw new Error("Expected the first model-turn request.");
		actor.send({
			type: "MODEL_TURN_TIMEOUT_REQUESTED",
			turnId: firstRequest.turnId,
			attemptId: firstRequest.attemptId,
		});
		expect(actor.getSnapshot().matches({ available: { turn: "idle" } })).toBe(
			true,
		);

		actor.send({
			type: "SUBMIT_PROMPT",
			input: {
				modality: "text",
				text: "Start a fresh turn after the timeout.",
			},
		});
		const secondRequest = actor.getSnapshot().context.portRequests.modelTurn;
		if (!secondRequest)
			throw new Error("Expected the second model-turn request.");
		expect(secondRequest.turnId).not.toBe(firstRequest.turnId);
		expect(secondRequest.attemptId).not.toBe(firstRequest.attemptId);

		actor.send({
			type: "MODEL_TURN_PORT_RECEIVED",
			request: firstRequest,
			receipt: {
				type: "PORT_FAILED",
				turnId: firstRequest.turnId,
				attemptId: firstRequest.attemptId,
				failure: { kind: "provider", message: "Stale child failure." },
			},
		});
		expect(actor.getSnapshot().context.portRequests.modelTurn).toEqual(
			secondRequest,
		);
		expect(
			actor.getSnapshot().matches({ available: { turn: "responding" } }),
		).toBe(true);
		actor.stop();
	});

	it("composes xstate graph paths with Story receipts without a bridge API", async () => {
		const selectedEvents: VoiceWorkbenchSessionEvent[] = [
			preparationAvailable1,
			submitPrompt,
		];
		const staticTimeoutSelection = getPathsFromEvents(
			voiceWorkbenchSessionMachine,
			[preparationAvailable1, submitPrompt, timeoutTurn],
			traversalOptions,
		);
		// Static graph traversal cannot correlate MODEL_TURN_TIMEOUT_REQUESTED to
		// the live runtime child request identity, so the timeout event stays inert
		// here. The Story fixture below proves the real timeout-to-ready outcome.
		expect(readStateValue(staticTimeoutSelection[0].state)).toEqual({
			available: { turn: "responding", voice: "active", speech: "idle" },
		});

		const directSelected = getPathsFromEvents(
			voiceWorkbenchSessionMachine,
			selectedEvents,
			traversalOptions,
		);
		expect(directSelected).toHaveLength(1);
		expect(directSelected[0].steps.map((step) => step.event.type)).toEqual([
			"xstate.init",
			"MODEL_PREPARATION_PORT_RECEIVED",
			"SUBMIT_PROMPT",
		]);
		expect(readStateValue(directSelected[0].state)).toEqual({
			available: { turn: "responding", voice: "active", speech: "idle" },
		});

		expect(() =>
			createTestModel(voiceWorkbenchSessionMachine, traversalOptions),
		).toThrowError(/Invocations .* not supported/i);

		const fixture = createGraphFixture();
		const story = await igniteTest({ component: fixture.component }).story(
			"xstate graph selected timeout path composes with story evidence",
			async (narrative) => {
				await narrative.given({
					when: (snapshot) => snapshot.matches({ available: { turn: "idle" } }),
					states: { status: "ready" },
					canExecute: { submitPrompt: true },
				});

				await narrative.intent({
					command: "submitPrompt",
					input: submitPrompt.input,
				});
				await fixture.waitForModelTurnCall();

				await narrative.checkpoint("turn is responding before timeout", {
					when: (snapshot) =>
						snapshot.matches({ available: { turn: "responding" } }),
					states: { status: "responding" },
					canExecute: { createArtifact: true },
				});

				await narrative.behavior(
					"fixture clock fires the active timeout request",
					async () => {
						expect(fixture.fireTimeout()).toBe(25);
					},
				);

				await narrative.checkpoint(
					"timeout returns the selected path to ready",
					{
						when: (snapshot) =>
							snapshot.matches({ available: { turn: "idle" } }),
						states: {
							status: "ready",
							lifecycle: {
								lastTurnTerminal: { type: "TIMEOUT" },
							},
						},
						canExecute: { submitPrompt: true },
					},
				);
			},
		);

		expect(story.trace.map((entry) => entry.kind)).toContain("behavior");
		expect(story.summary.finalSnapshot).toMatchObject({
			value: {
				available: { turn: "idle", voice: "active", speech: "idle" },
			},
		});
		expect(story.summary.finalStates).toMatchObject({
			status: "ready",
			lifecycle: {
				lastTurnTerminal: { type: "TIMEOUT" },
			},
		});
		expect(
			story.trace.some(
				(entry) => entry.kind === "command" && entry.command === "submitPrompt",
			),
		).toBe(true);
	});
});
