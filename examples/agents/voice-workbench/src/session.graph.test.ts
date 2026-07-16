import { describe, expect, it } from "vitest";
import {
	adjacencyMapToArray,
	getAdjacencyMap,
	getPathsFromEvents,
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
] as const satisfies readonly VoiceWorkbenchSessionEvent[];

type GraphEventDisposition =
	| "included-lifecycle"
	| "included-canonical-payload"
	| "excluded-context-cycle"
	| "excluded-presentation-envelope";

// A newly added machine event is a compile-time graph-policy review point.
const graphEventPolicy = {
	MODEL_AVAILABLE: "included-lifecycle",
	MODEL_FAILED: "included-canonical-payload",
	MODEL_PREPARATION_STARTED: "included-lifecycle",
	SUBMIT_PROMPT: "included-canonical-payload",
	CREATE_ARTIFACT: "included-canonical-payload",
	REVISE_ARTIFACT: "excluded-context-cycle",
	RESTORE_ARTIFACT_REVISION: "excluded-context-cycle",
	SELECT_ARTIFACT: "excluded-context-cycle",
	SET_CHECKLIST_ITEM: "excluded-context-cycle",
	COMPLETE_RESPONSE: "included-canonical-payload",
	ACKNOWLEDGE_SPEECH: "excluded-context-cycle",
	PRESENTATION_UPDATED: "excluded-presentation-envelope",
} as const satisfies Record<
	VoiceWorkbenchSessionEvent["type"],
	GraphEventDisposition
>;

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
	},
	"available/idle": {
		MODEL_AVAILABLE: "available/idle",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/idle",
		COMPLETE_RESPONSE: "available/idle",
	},
	unavailable: {
		MODEL_AVAILABLE: "available/idle",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "unavailable",
		CREATE_ARTIFACT: "unavailable",
		COMPLETE_RESPONSE: "unavailable",
	},
	"available/responding": {
		MODEL_AVAILABLE: "available/responding",
		MODEL_FAILED: "unavailable",
		MODEL_PREPARATION_STARTED: "preparing",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/responding",
		COMPLETE_RESPONSE: "available/idle",
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
	const paths = getPathsFromEvents(
		voiceWorkbenchSessionMachine,
		[...events],
		baseTraversalOptions,
	);
	expect(paths).toHaveLength(1);
	const [path] = paths;
	if (!path) throw new Error("Expected one XState graph path.");
	return path;
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
			Object.values(graphEventPolicy).filter((value) =>
				value.startsWith("excluded-"),
			),
		).toHaveLength(6);
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
