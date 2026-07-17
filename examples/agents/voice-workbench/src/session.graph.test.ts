import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
	adjacencyMapToArray,
	getAdjacencyMap,
	getShortestPaths,
	getSimplePaths,
} from "xstate/graph";
import {
	isVoiceWorkbenchKnownForbiddenStateValue,
	type VoiceWorkbenchSessionEvent,
	type VoiceWorkbenchSessionSnapshot,
	type VoiceWorkbenchSessionStateValue,
	voiceWorkbenchKnownForbiddenStateValues,
	voiceWorkbenchSessionInvariants,
	voiceWorkbenchSessionMachine,
} from "./session";

const GRAPH_TRAVERSAL_LIMIT = 128;

const eventCases = {
	modelAvailable: { type: "MODEL_AVAILABLE" },
	modelFailed: {
		type: "MODEL_FAILED",
		failure: {
			kind: "network",
			message: "Graph fixture model connection failed.",
		},
	},
	modelPreparationStarted: { type: "MODEL_PREPARATION_STARTED" },
	submitPrompt: {
		type: "SUBMIT_PROMPT",
		input: {
			modality: "text",
			text: "Characterize the voice workbench graph.",
		},
	},
	createArtifact: {
		type: "CREATE_ARTIFACT",
		input: {
			id: "graph-artifact",
			title: "Graph artifact",
			nodes: [
				{
					kind: "text",
					id: "graph-summary",
					text: "The graph path applied an artifact mutation.",
				},
			],
		},
	},
	completeResponse: {
		type: "COMPLETE_RESPONSE",
		input: { text: "Graph characterization completed." },
	},
	turnCompleted: { type: "TURN_COMPLETED", turnId: "voice-workbench:1" },
	turnFailed: {
		type: "TURN_FAILED",
		turnId: "voice-workbench:1",
		failure: { kind: "provider", message: "Graph turn failed." },
	},
	cancelled: { type: "CANCELLED", turnId: "voice-workbench:1" },
	timeout: { type: "TIMEOUT", turnId: "voice-workbench:1" },
	roundLimitReached: {
		type: "ROUND_LIMIT_REACHED",
		turnId: "voice-workbench:1",
	},
} as const satisfies Record<string, VoiceWorkbenchSessionEvent>;

// Exactly one deterministic case is admitted for each lifecycle or aggregate
// event used by the graph. The private presentation envelope and
// context-dependent revision/history cycles stay out of exhaustive traversal
// so mutable context cannot turn the state-value graph into an unbounded graph.
const graphEventCases = [
	eventCases.modelAvailable,
	eventCases.modelFailed,
	eventCases.modelPreparationStarted,
	eventCases.submitPrompt,
	eventCases.createArtifact,
	eventCases.completeResponse,
	eventCases.turnCompleted,
	eventCases.turnFailed,
	eventCases.cancelled,
	eventCases.timeout,
	eventCases.roundLimitReached,
] as const satisfies readonly VoiceWorkbenchSessionEvent[];

type GraphEventDisposition =
	| "included-lifecycle"
	| "included-canonical-payload"
	| "excluded-context-cycle"
	| "excluded-presentation-envelope"
	| "excluded-private-event";

// A newly added machine event is a compile-time graph-policy review point.
const graphEventPolicy = {
	MODEL_AVAILABLE: "included-lifecycle",
	MODEL_FAILED: "included-canonical-payload",
	MODEL_PREPARATION_STARTED: "included-lifecycle",
	VOICE_CAPTURE_START_REQUESTED: "excluded-context-cycle",
	VOICE_CAPTURE_CANCEL_REQUESTED: "excluded-context-cycle",
	VOICE_TRANSCRIPT_SUBMIT_REQUESTED: "excluded-context-cycle",
	SPEECH_DELIVERY_REPLAY_REQUESTED: "excluded-context-cycle",
	SUBMIT_PROMPT: "included-canonical-payload",
	CREATE_ARTIFACT: "included-canonical-payload",
	REVISE_ARTIFACT: "excluded-context-cycle",
	RESTORE_ARTIFACT_REVISION: "excluded-context-cycle",
	SELECT_ARTIFACT: "excluded-context-cycle",
	SET_CHECKLIST_ITEM: "excluded-context-cycle",
	COMPLETE_RESPONSE: "included-canonical-payload",
	TURN_COMPLETED: "included-canonical-payload",
	TURN_FAILED: "included-canonical-payload",
	CANCELLED: "included-canonical-payload",
	TIMEOUT: "included-canonical-payload",
	ROUND_LIMIT_REACHED: "included-canonical-payload",
	ACKNOWLEDGE_SPEECH: "excluded-context-cycle",
	PRESENTATION_UPDATED: "excluded-presentation-envelope",
	DOCUMENT_COMMITTED: "excluded-private-event",
	VOICE_TRANSCRIPT_CONSUMED: "excluded-private-event",
	CAPABILITY_OUTCOME_RECORDED: "excluded-private-event",
	DOMAIN_POLICY_RECORDED: "excluded-private-event",
	RUNTIME_MANIFEST_RECORDED: "excluded-private-event",
	TURN_RECORDED: "excluded-private-event",
	MODEL_TURN_LIFECYCLE_UPDATED: "excluded-private-event",
	VOICE_CAPTURE_LIFECYCLE_UPDATED: "excluded-private-event",
	SPEECH_DELIVERY_LIFECYCLE_UPDATED: "excluded-private-event",
} as const satisfies Record<
	VoiceWorkbenchSessionEvent["type"],
	GraphEventDisposition
>;

const expectedExcludedGraphEventPolicy = {
	VOICE_CAPTURE_START_REQUESTED: "excluded-context-cycle",
	VOICE_CAPTURE_CANCEL_REQUESTED: "excluded-context-cycle",
	VOICE_TRANSCRIPT_SUBMIT_REQUESTED: "excluded-context-cycle",
	SPEECH_DELIVERY_REPLAY_REQUESTED: "excluded-context-cycle",
	REVISE_ARTIFACT: "excluded-context-cycle",
	RESTORE_ARTIFACT_REVISION: "excluded-context-cycle",
	SELECT_ARTIFACT: "excluded-context-cycle",
	SET_CHECKLIST_ITEM: "excluded-context-cycle",
	ACKNOWLEDGE_SPEECH: "excluded-context-cycle",
	PRESENTATION_UPDATED: "excluded-presentation-envelope",
	DOCUMENT_COMMITTED: "excluded-private-event",
	VOICE_TRANSCRIPT_CONSUMED: "excluded-private-event",
	CAPABILITY_OUTCOME_RECORDED: "excluded-private-event",
	DOMAIN_POLICY_RECORDED: "excluded-private-event",
	RUNTIME_MANIFEST_RECORDED: "excluded-private-event",
	TURN_RECORDED: "excluded-private-event",
	MODEL_TURN_LIFECYCLE_UPDATED: "excluded-private-event",
	VOICE_CAPTURE_LIFECYCLE_UPDATED: "excluded-private-event",
	SPEECH_DELIVERY_LIFECYCLE_UPDATED: "excluded-private-event",
} as const satisfies Record<string, GraphEventDisposition>;

const readRawStateValue = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): VoiceWorkbenchSessionStateValue => {
	const value = snapshot.value;
	if (value === "preparing" || value === "unavailable") return value;
	if (
		typeof value === "object" &&
		value !== null &&
		"available" in value &&
		(value.available === "idle" || value.available === "responding")
	) {
		return { available: value.available };
	}
	throw new Error(`Unexpected voice-workbench state: ${JSON.stringify(value)}`);
};

const serializeRawState = (snapshot: VoiceWorkbenchSessionSnapshot): string =>
	JSON.stringify(readRawStateValue(snapshot));

const serializeEventCase = (event: VoiceWorkbenchSessionEvent): string =>
	JSON.stringify(event);

const baseTraversalOptions = {
	filterEvents: (
		_snapshot: VoiceWorkbenchSessionSnapshot,
		event: VoiceWorkbenchSessionEvent,
	) => graphEventPolicy[event.type].startsWith("included-"),
	limit: GRAPH_TRAVERSAL_LIMIT,
	serializeEvent: serializeEventCase,
	serializeState: serializeRawState,
	stopWhen: () => false,
};

const graphTraversalOptions = {
	...baseTraversalOptions,
	events: graphEventCases,
};

const currentStateValueBaseline = [
	"preparing",
	{ available: "idle" },
	"unavailable",
	{ available: "responding" },
] as const satisfies readonly VoiceWorkbenchSessionStateValue[];

type RawStateLabel =
	| "preparing"
	| "unavailable"
	| "available/idle"
	| "available/responding";
type IncludedGraphEventType = (typeof graphEventCases)[number]["type"];

const labelRawState = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): RawStateLabel => {
	const value = readRawStateValue(snapshot);
	if (typeof value === "string") return value;
	return `available/${value.available}`;
};

// XState's generated adjacency map remains the actual graph source. This
// separately authored matrix locks every included event-labelled edge.
const transitionTargetBaseline = {
	preparing: {
		MODEL_AVAILABLE: "available/idle",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "preparing",
		CREATE_ARTIFACT: "preparing",
		COMPLETE_RESPONSE: "preparing",
		TURN_COMPLETED: "preparing",
		TURN_FAILED: "preparing",
		CANCELLED: "preparing",
		TIMEOUT: "preparing",
		ROUND_LIMIT_REACHED: "preparing",
	},
	"available/idle": {
		MODEL_AVAILABLE: "available/idle",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/idle",
		COMPLETE_RESPONSE: "available/idle",
		TURN_COMPLETED: "available/idle",
		TURN_FAILED: "available/idle",
		CANCELLED: "available/idle",
		TIMEOUT: "available/idle",
		ROUND_LIMIT_REACHED: "available/idle",
	},
	unavailable: {
		MODEL_AVAILABLE: "available/idle",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "unavailable",
		CREATE_ARTIFACT: "unavailable",
		COMPLETE_RESPONSE: "unavailable",
		TURN_COMPLETED: "unavailable",
		TURN_FAILED: "unavailable",
		CANCELLED: "unavailable",
		TIMEOUT: "unavailable",
		ROUND_LIMIT_REACHED: "unavailable",
	},
	"available/responding": {
		MODEL_AVAILABLE: "available/responding",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/responding",
		COMPLETE_RESPONSE: "available/responding",
		TURN_COMPLETED: "available/responding",
		TURN_FAILED: "available/idle",
		CANCELLED: "available/idle",
		TIMEOUT: "available/idle",
		ROUND_LIMIT_REACHED: "available/idle",
	},
} as const satisfies Record<
	RawStateLabel,
	Record<IncludedGraphEventType, RawStateLabel>
>;

const transitionSignature = (
	source: string,
	eventType: string,
	target: string,
): string => `${source} --${eventType}--> ${target}`;

const expectedTransitionSignatures = Object.entries(transitionTargetBaseline)
	.flatMap(([source, targets]) =>
		Object.entries(targets).map(([eventType, target]) =>
			transitionSignature(source, eventType, target),
		),
	)
	.sort();

const namedEventPaths = {
	modelAvailable: [eventCases.modelAvailable],
	modelFailed: [eventCases.modelFailed],
	retryPreparation: [
		eventCases.modelFailed,
		eventCases.modelPreparationStarted,
	],
	promptAdmission: [eventCases.modelAvailable, eventCases.submitPrompt],
	artifactMutation: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.createArtifact,
	],
	acceptedCompletion: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.completeResponse,
		eventCases.turnCompleted,
	],
	turnFailure: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.turnFailed,
	],
	cancellation: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.cancelled,
	],
	timeout: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.timeout,
	],
	roundLimit: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.roundLimitReached,
	],
	failureFromResponding: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.modelFailed,
	],
	failureRecovery: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.modelFailed,
		eventCases.modelAvailable,
	],
} as const satisfies Record<string, readonly VoiceWorkbenchSessionEvent[]>;

const getNamedPath = (events: readonly VoiceWorkbenchSessionEvent[]) => {
	const actor = createActor(voiceWorkbenchSessionMachine).start();
	for (const event of events) actor.send(event);
	const state = actor.getSnapshot();
	actor.stop();
	return { state };
};

describe("voice workbench XState graph characterization", () => {
	it("bounds deterministic raw-snapshot traversal and its exclusions", () => {
		const includedEventTypes = Object.entries(graphEventPolicy)
			.filter(([, disposition]) => disposition.startsWith("included-"))
			.map(([type]) => type);

		expect(GRAPH_TRAVERSAL_LIMIT).toBe(128);
		expect(includedEventTypes).toEqual(
			graphEventCases.map((event) => event.type),
		);
		expect(new Set(graphEventCases.map(serializeEventCase)).size).toBe(
			graphEventCases.length,
		);
		expect(
			Object.fromEntries(
				Object.entries(graphEventPolicy).filter(([, disposition]) =>
					disposition.startsWith("excluded-"),
				),
			),
		).toEqual(expectedExcludedGraphEventPolicy);
	});

	it("characterizes excluded voice and speech context cycles directly", () => {
		const actor = createActor(voiceWorkbenchSessionMachine).start();
		const send = (event: Record<string, unknown>) =>
			(actor.send as (value: unknown) => void)(event);
		actor.send(eventCases.modelAvailable);
		expect(readRawStateValue(actor.getSnapshot())).toEqual({
			available: "idle",
		});
		send({
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED",
			lifecycle: {
				state: "idle",
				attemptId: null,
				sequence: 0,
				fact: { type: "voice-idle" },
			},
		});

		send({ type: "VOICE_CAPTURE_START_REQUESTED" });
		send({ type: "VOICE_CAPTURE_CANCEL_REQUESTED" });
		expect(readRawStateValue(actor.getSnapshot())).toEqual({
			available: "idle",
		});
		expect(actor.getSnapshot().context).toMatchObject({
			voiceCaptureControlSequence: 2,
			voiceCaptureControlRequest: { action: "cancel", sequence: 2 },
		});
		send({ type: "SPEECH_DELIVERY_REPLAY_REQUESTED" });
		expect(actor.getSnapshot().context).toMatchObject({
			speechDeliveryControlSequence: 0,
			speechDeliveryControlRequest: null,
		});

		actor.send(eventCases.submitPrompt);
		send({
			type: "COMPLETE_RESPONSE",
			input: {
				text: "Graph speech response.",
				speech: "Graph speech response.",
			},
		});
		actor.send(eventCases.turnCompleted);
		expect(readRawStateValue(actor.getSnapshot())).toEqual({
			available: "idle",
		});
		expect(actor.getSnapshot().context).toMatchObject({
			speechDeliveryControlSequence: 1,
			speechDeliveryControlRequest: { sequence: 1 },
		});
		send({ type: "SPEECH_DELIVERY_REPLAY_REQUESTED" });
		expect(readRawStateValue(actor.getSnapshot())).toEqual({
			available: "idle",
		});
		expect(actor.getSnapshot().context).toMatchObject({
			speechDeliveryControlSequence: 2,
			speechDeliveryControlRequest: { sequence: 2 },
		});
		expect(
			voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(
				actor.getSnapshot(),
			),
		).toBe(true);
		actor.stop();
	});

	it("characterizes exactly four compound lifecycle values", () => {
		const shortestPaths = getShortestPaths(
			voiceWorkbenchSessionMachine,
			graphTraversalOptions,
		);
		const simplePaths = getSimplePaths(
			voiceWorkbenchSessionMachine,
			graphTraversalOptions,
		);

		expect(shortestPaths.map((path) => readRawStateValue(path.state))).toEqual(
			currentStateValueBaseline,
		);
		expect(
			new Set(simplePaths.map((path) => serializeRawState(path.state))),
		).toEqual(
			new Set(currentStateValueBaseline.map((value) => JSON.stringify(value))),
		);
	});

	it("locks every included event-labelled edge across all four raw vertices", () => {
		const adjacencyMap = getAdjacencyMap(
			voiceWorkbenchSessionMachine,
			graphTraversalOptions,
		);
		const actualTransitionSignatures = adjacencyMapToArray(adjacencyMap)
			.map(({ state, event, nextState }) =>
				transitionSignature(
					labelRawState(state),
					event.type,
					labelRawState(nextState),
				),
			)
			.sort();

		expect(Object.keys(adjacencyMap)).toEqual(
			currentStateValueBaseline.map((value) => JSON.stringify(value)),
		);
		expect(actualTransitionSignatures).toHaveLength(
			currentStateValueBaseline.length * graphEventCases.length,
		);
		expect(actualTransitionSignatures).toEqual(expectedTransitionSignatures);
		expect(actualTransitionSignatures).toContain(
			"available/responding --MODEL_FAILED--> unavailable",
		);
		expect(actualTransitionSignatures).toContain(
			"available/responding --TIMEOUT--> available/idle",
		);
	});

	it("has zero forbidden reachable snapshots", () => {
		const shortestPaths = getShortestPaths(
			voiceWorkbenchSessionMachine,
			graphTraversalOptions,
		);
		const forbiddenSnapshots = shortestPaths
			.map((path) => path.state)
			.filter(
				(snapshot) =>
					!voiceWorkbenchSessionInvariants.hasNoKnownForbiddenState(snapshot),
			);

		expect(voiceWorkbenchKnownForbiddenStateValues).toEqual([]);
		expect(forbiddenSnapshots).toEqual([]);
		for (const path of shortestPaths) {
			expect(isVoiceWorkbenchKnownForbiddenStateValue(path.state.value)).toBe(
				false,
			);
			expect(
				voiceWorkbenchSessionInvariants.respondingRequiresAvailable(path.state),
			).toBe(true);
		}
	});

	it("covers model availability, failure, and retry preparation paths", () => {
		const availablePath = getNamedPath(namedEventPaths.modelAvailable);
		const failedPath = getNamedPath(namedEventPaths.modelFailed);
		const retryPath = getNamedPath(namedEventPaths.retryPreparation);

		expect(readRawStateValue(availablePath.state)).toEqual({
			available: "idle",
		});
		expect(readRawStateValue(failedPath.state)).toBe("unavailable");
		expect(failedPath.state.context.modelFailure).toEqual(
			eventCases.modelFailed.failure,
		);
		expect(readRawStateValue(retryPath.state)).toBe("preparing");
		expect(retryPath.state.context.modelFailure).toBeNull();
	});

	it("covers prompt admission, artifact mutation, and accepted completion", () => {
		const promptPath = getNamedPath(namedEventPaths.promptAdmission);
		const artifactPath = getNamedPath(namedEventPaths.artifactMutation);
		const completionPath = getNamedPath(namedEventPaths.acceptedCompletion);

		expect(readRawStateValue(promptPath.state)).toEqual({
			available: "responding",
		});
		expect(promptPath.state.context.lastFact?.type).toBe("prompt-submitted");
		expect(artifactPath.state.context.documents).toEqual([
			expect.objectContaining({ id: "graph-artifact", revision: "1" }),
		]);
		expect(artifactPath.state.context.lastFact?.type).toBe("artifact-created");
		expect(readRawStateValue(completionPath.state)).toEqual({
			available: "idle",
		});
		expect(completionPath.state.context.response).toEqual(
			eventCases.completeResponse.input,
		);
		expect(completionPath.state.context.lastFact?.type).toBe(
			"response-completed",
		);
	});

	it("covers every non-provider terminal recovery without fabricating a response", () => {
		for (const events of [
			namedEventPaths.turnFailure,
			namedEventPaths.cancellation,
			namedEventPaths.timeout,
			namedEventPaths.roundLimit,
		]) {
			const path = getNamedPath(events);
			expect(readRawStateValue(path.state)).toEqual({ available: "idle" });
			expect(path.state.context.response).toBeNull();
			expect(path.state.context.lastFact?.type).toBe("prompt-submitted");
		}
	});

	it("records a non-success receipt and recovers to a fresh idle turn", () => {
		const failurePath = getNamedPath(namedEventPaths.failureFromResponding);
		const recoveryPath = getNamedPath(namedEventPaths.failureRecovery);

		expect(readRawStateValue(failurePath.state)).toBe("unavailable");
		expect(failurePath.state.context.modelFailure).toEqual(
			eventCases.modelFailed.failure,
		);
		expect(failurePath.state.context.presentation.turn).toEqual({
			type: "model-failed",
			failureKind: "network",
			message: "Graph fixture model connection failed.",
			trace: [],
		});
		expect(failurePath.state.context.response).toBeNull();
		expect(failurePath.state.context.lastFact?.type).toBe("prompt-submitted");
		expect(readRawStateValue(recoveryPath.state)).toEqual({
			available: "idle",
		});
		expect(recoveryPath.state.context.modelFailure).toBeNull();
	});
});
