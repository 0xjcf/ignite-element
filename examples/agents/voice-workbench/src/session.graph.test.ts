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
// event used by the graph. Presentation-only events and context-dependent
// revision/history cycles stay out of exhaustive traversal so mutable context
// cannot turn the state-value graph into an unbounded graph.
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
	| "excluded-presentation-only";

// This exhaustive policy makes a newly added machine event a compile-time
// review point instead of letting graph coverage drift silently.
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
	PRESENTATION_DRAFT_CHANGED: "excluded-presentation-only",
	PRESENTATION_VOICE_CHANGED: "excluded-presentation-only",
	PRESENTATION_ARTIFACT_VIEW_CHANGED: "excluded-presentation-only",
	PRESENTATION_MOBILE_PANEL_CHANGED: "excluded-presentation-only",
	PRESENTATION_SPEECH_PREFERENCE_CHANGED: "excluded-presentation-only",
	PRESENTATION_TURN_RECORDED: "excluded-presentation-only",
	PRESENTATION_DOCUMENT_COMMITTED: "excluded-presentation-only",
	PRESENTATION_SPEECH_COMMITTED: "excluded-presentation-only",
	PRESENTATION_SPEECH_REPLAY_REQUESTED: "excluded-presentation-only",
	PRESENTATION_REPLAYED: "excluded-presentation-only",
	PRESENTATION_RUNTIME_MANIFEST_RECORDED: "excluded-presentation-only",
	PRESENTATION_RUNTIME_PREVIEW_SELECTED: "excluded-presentation-only",
	PRESENTATION_CAPABILITY_OUTCOME_RECORDED: "excluded-presentation-only",
	PRESENTATION_DOMAIN_POLICY_RECORDED: "excluded-presentation-only",
	PRESENTATION_VOICE_CAPTURE_REQUESTED: "excluded-presentation-only",
} as const satisfies Record<
	VoiceWorkbenchSessionEvent["type"],
	GraphEventDisposition
>;

const isProviderValue = (
	value: unknown,
): value is VoiceWorkbenchSessionStateValue["provider"] =>
	value === "preparing" || value === "available" || value === "failed";

const isTurnValue = (
	value: unknown,
): value is VoiceWorkbenchSessionStateValue["turn"] =>
	value === "ready" || value === "responding";

const readRawStateValue = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): VoiceWorkbenchSessionStateValue => {
	const value = snapshot.value;
	if (
		typeof value !== "object" ||
		value === null ||
		!("provider" in value) ||
		!("turn" in value) ||
		!isProviderValue(value.provider) ||
		!isTurnValue(value.turn)
	) {
		throw new Error(
			`Unexpected voice-workbench state: ${JSON.stringify(value)}`,
		);
	}
	return { provider: value.provider, turn: value.turn };
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
	{ provider: "preparing", turn: "ready" },
	{ provider: "available", turn: "ready" },
	{ provider: "failed", turn: "ready" },
	{ provider: "available", turn: "responding" },
	{ provider: "failed", turn: "responding" },
	{ provider: "preparing", turn: "responding" },
] as const satisfies readonly VoiceWorkbenchSessionStateValue[];

type RawStateLabel =
	`${VoiceWorkbenchSessionStateValue["provider"]}/${VoiceWorkbenchSessionStateValue["turn"]}`;
type IncludedGraphEventType = (typeof graphEventCases)[number]["type"];

const labelRawState = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): RawStateLabel => {
	const value = readRawStateValue(snapshot);
	return `${value.provider}/${value.turn}`;
};

// Every included event is asserted from every serialized raw vertex. This is
// deliberately an expected edge matrix, not another traversal implementation;
// XState's adjacency map remains the source of the actual transition graph.
const transitionTargetBaseline = {
	"preparing/ready": {
		MODEL_AVAILABLE: "available/ready",
		MODEL_FAILED: "failed/ready",
		MODEL_PREPARATION_STARTED: "preparing/ready",
		SUBMIT_PROMPT: "preparing/ready",
		CREATE_ARTIFACT: "preparing/ready",
		COMPLETE_RESPONSE: "preparing/ready",
	},
	"available/ready": {
		MODEL_AVAILABLE: "available/ready",
		MODEL_FAILED: "failed/ready",
		MODEL_PREPARATION_STARTED: "preparing/ready",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/ready",
		COMPLETE_RESPONSE: "available/ready",
	},
	"failed/ready": {
		MODEL_AVAILABLE: "available/ready",
		MODEL_FAILED: "failed/ready",
		MODEL_PREPARATION_STARTED: "preparing/ready",
		SUBMIT_PROMPT: "failed/ready",
		CREATE_ARTIFACT: "failed/ready",
		COMPLETE_RESPONSE: "failed/ready",
	},
	"available/responding": {
		MODEL_AVAILABLE: "available/responding",
		MODEL_FAILED: "failed/responding",
		MODEL_PREPARATION_STARTED: "preparing/responding",
		SUBMIT_PROMPT: "available/responding",
		CREATE_ARTIFACT: "available/responding",
		COMPLETE_RESPONSE: "available/ready",
	},
	"failed/responding": {
		MODEL_AVAILABLE: "available/responding",
		MODEL_FAILED: "failed/responding",
		MODEL_PREPARATION_STARTED: "preparing/responding",
		SUBMIT_PROMPT: "failed/responding",
		CREATE_ARTIFACT: "failed/responding",
		COMPLETE_RESPONSE: "failed/ready",
	},
	"preparing/responding": {
		MODEL_AVAILABLE: "available/responding",
		MODEL_FAILED: "failed/responding",
		MODEL_PREPARATION_STARTED: "preparing/responding",
		SUBMIT_PROMPT: "preparing/responding",
		CREATE_ARTIFACT: "preparing/responding",
		COMPLETE_RESPONSE: "preparing/ready",
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

// Temporary reviewed debt. task-1784171435029 owns restructuring the topology
// so this baseline becomes an empty list and the forbidden count becomes zero.
const temporaryForbiddenStateBaseline = {
	owner: "task-1784171435029",
	values: [
		{ provider: "preparing", turn: "responding" },
		// "failed" is the current raw state name for conceptual Unavailable.
		{ provider: "failed", turn: "responding" },
	],
} as const satisfies {
	owner: "task-1784171435029";
	values: readonly VoiceWorkbenchSessionStateValue[];
};

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
	currentFailureRecovery: [
		eventCases.modelAvailable,
		eventCases.submitPrompt,
		eventCases.modelFailed,
		eventCases.completeResponse,
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
		).toHaveLength(20);
	});

	it("characterizes exactly six current raw provider/turn values", () => {
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
		expect(simplePaths).toHaveLength(17);
		expect(
			new Set(simplePaths.map((path) => serializeRawState(path.state))),
		).toEqual(
			new Set(currentStateValueBaseline.map((value) => JSON.stringify(value))),
		);
	});

	it("locks every included event-labelled edge across all six raw vertices", () => {
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
			"failed/responding --MODEL_AVAILABLE--> available/responding",
		);
	});

	it("keeps exactly two reviewed forbidden raw states until task-1784171435029", () => {
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

		expect(temporaryForbiddenStateBaseline.owner).toBe("task-1784171435029");
		expect(voiceWorkbenchKnownForbiddenStateValues).toEqual(
			temporaryForbiddenStateBaseline.values,
		);
		expect(forbiddenSnapshots).toHaveLength(2);
		expect(
			new Set(
				forbiddenSnapshots.map((snapshot) =>
					JSON.stringify(readRawStateValue(snapshot)),
				),
			),
		).toEqual(
			new Set(
				temporaryForbiddenStateBaseline.values.map((value) =>
					JSON.stringify(value),
				),
			),
		);
		for (const snapshot of forbiddenSnapshots) {
			expect(isVoiceWorkbenchKnownForbiddenStateValue(snapshot.value)).toBe(
				true,
			);
			expect(
				voiceWorkbenchSessionInvariants.respondingRequiresAvailable(snapshot),
			).toBe(false);
		}
	});

	it("covers provider availability, failure, and retry preparation paths", () => {
		const availablePath = getNamedPath(namedEventPaths.modelAvailable);
		const failedPath = getNamedPath(namedEventPaths.modelFailed);
		const retryPath = getNamedPath(namedEventPaths.retryPreparation);

		expect(readRawStateValue(availablePath.state)).toEqual({
			provider: "available",
			turn: "ready",
		});
		expect(readRawStateValue(failedPath.state)).toEqual({
			provider: "failed",
			turn: "ready",
		});
		expect(failedPath.state.context.modelFailure).toEqual(
			eventCases.modelFailed.failure,
		);
		expect(readRawStateValue(retryPath.state)).toEqual({
			provider: "preparing",
			turn: "ready",
		});
		expect(retryPath.state.context.modelFailure).toBeNull();
	});

	it("covers prompt admission, artifact mutation, and accepted completion", () => {
		const promptPath = getNamedPath(namedEventPaths.promptAdmission);
		const artifactPath = getNamedPath(namedEventPaths.artifactMutation);
		const completionPath = getNamedPath(namedEventPaths.acceptedCompletion);

		expect(readRawStateValue(promptPath.state)).toEqual({
			provider: "available",
			turn: "responding",
		});
		expect(promptPath.state.context.lastFact?.type).toBe("prompt-submitted");
		expect(artifactPath.state.context.documents).toEqual([
			expect.objectContaining({ id: "graph-artifact", revision: "1" }),
		]);
		expect(artifactPath.state.context.lastFact?.type).toBe("artifact-created");
		expect(readRawStateValue(completionPath.state)).toEqual({
			provider: "available",
			turn: "ready",
		});
		expect(completionPath.state.context.response).toEqual(
			eventCases.completeResponse.input,
		);
		expect(completionPath.state.context.lastFact?.type).toBe(
			"response-completed",
		);
	});

	it("captures the current provider-failure recovery path through a forbidden raw snapshot", () => {
		const recoveryPath = getNamedPath(namedEventPaths.currentFailureRecovery);
		const forbiddenStep = recoveryPath.steps.find((step) =>
			isVoiceWorkbenchKnownForbiddenStateValue(step.state.value),
		);

		expect(forbiddenStep).toBeDefined();
		expect(
			readRawStateValue(forbiddenStep?.state ?? recoveryPath.state),
		).toEqual({ provider: "failed", turn: "responding" });
		expect(readRawStateValue(recoveryPath.state)).toEqual({
			provider: "failed",
			turn: "ready",
		});
		expect(recoveryPath.state.context.modelFailure).toEqual(
			eventCases.modelFailed.failure,
		);
		expect(recoveryPath.state.context.lastFact?.type).toBe(
			"response-completed",
		);
	});
});
