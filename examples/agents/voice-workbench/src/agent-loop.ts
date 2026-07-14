import type { NeutralManifest } from "ignite-element/tools";

const MODEL_COMMANDS = [
	"createArtifact",
	"reviseArtifact",
	"setChecklistItem",
	"completeResponse",
] as const;

type ModelCommand = (typeof MODEL_COMMANDS)[number];

export type ModelToolCall = { id?: string; command: string; input: unknown };
export type ModelToolFeedback = {
	id: string;
	command: string;
	status: "accepted" | "actor-rejected" | "tool-error" | "deferred";
	reason?: string;
	issues?: readonly string[];
	view: unknown;
	events: readonly { type: string; reason?: string }[];
};
export type ModelExchange = {
	calls: readonly (ModelToolCall & { id: string })[];
	results: readonly ModelToolFeedback[];
};
export type ModelFailureKind =
	| "configuration"
	| "network"
	| "timeout"
	| "provider"
	| "invalid-response";
export type ModelFailureFact = {
	kind: ModelFailureKind;
	message: string;
	status?: number;
};
export type ModelResult =
	| { ok: true; calls: readonly ModelToolCall[] }
	| { ok: false; error: ModelFailureFact };
export type ModelRequest = {
	prompt: { channel: "text" | "speech"; text: string };
	tools: NeutralManifest;
	view: unknown;
	history: readonly ModelExchange[];
};
export type ModelTurnTrace = { command: string; accepted: boolean };
export type ModelTurnResult =
	| { accepted: true; trace: ModelTurnTrace[]; exchange: ModelExchange }
	| {
			accepted: false;
			reason: "prompt-rejected" | "response-incomplete";
			trace: ModelTurnTrace[];
			exchange: ModelExchange;
	  }
	| {
			accepted: false;
			reason: "model-failed";
			failure: ModelFailureFact;
			trace: ModelTurnTrace[];
	  }
	| {
			accepted: false;
			reason: "command-not-allowed" | "command-rejected";
			command: string;
			trace: ModelTurnTrace[];
			exchange: ModelExchange;
	  };

const isModelCommand = (name: string): name is ModelCommand =>
	MODEL_COMMANDS.includes(name as ModelCommand);

export const modelTools = (
	manifest: NeutralManifest,
	externalCommands: readonly string[] = [],
): NeutralManifest =>
	manifest.filter(
		(tool) =>
			isModelCommand(tool.name) || externalCommands.includes(tool.name),
	);

const failureMessage = (kind: ModelFailureKind): string => {
	switch (kind) {
		case "configuration":
			return "Configure the local model URL and model name, then try again.";
		case "network":
			return "The local model could not be reached. Check its configuration and try again.";
		case "timeout":
			return "The local model timed out. Try again.";
		case "invalid-response":
			return "The local model returned an invalid response. Try again.";
		case "provider":
			return "The local model could not complete this turn. Try again.";
	}
};

const sanitizedFailure = (
	failure: Pick<ModelFailureFact, "kind" | "status">,
): ModelFailureFact => ({
	kind: failure.kind,
	message: failureMessage(failure.kind),
	...(failure.status === undefined ? {} : { status: failure.status }),
});

const recoveryCall = (message: string): ModelToolCall => ({
	id: "workbench-recovery",
	command: "completeResponse",
	input: { text: message },
});

/**
 * A pure protocol for one model round. Exactly one proposed tool call executes
 * before the model observes its result. Sibling calls receive deferred results,
 * which keeps the provider transcript valid while preventing an artifact
 * mutation and completion from being accepted in the same unobserved round.
 */
export function* modelTurn(
	response: ModelResult,
): Generator<ModelToolCall, ModelTurnResult, ModelToolFeedback> {
	const trace: ModelTurnTrace[] = [];
	if (!response.ok) {
		const failure = sanitizedFailure(response.error);
		const feedback = yield recoveryCall(failure.message);
		const accepted = feedback.status === "accepted";
		trace.push({ command: "completeResponse", accepted });
		return {
			accepted: false,
			reason: "model-failed",
			failure,
			trace,
		};
	}
	const calls = response.calls.map((call, index) => ({
		...call,
		id: call.id?.trim() || `model-call-${index}`,
	}));
	const mutation = calls.find(
		(call) =>
			call.command === "createArtifact" ||
			call.command === "reviseArtifact" ||
			call.command === "setChecklistItem",
	);
	const primary = mutation ?? calls[0];
	if (!primary) {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
			exchange: { calls, results: [] },
		};
	}

	const feedback = yield primary;
	const callAccepted = feedback.status === "accepted";
	trace.push({ command: primary.command, accepted: callAccepted });
	const results = calls.map((call): ModelToolFeedback => {
		if (call.id === primary.id) {
			return {
				...feedback,
				id: call.id,
				command: call.command,
			};
		}
		return {
			id: call.id,
			command: call.command,
			status: "deferred",
			reason: mutation
				? "observe-artifact-mutation-before-continuing"
				: "observe-tool-result-before-continuing",
			view: feedback.view,
			events: [],
		};
	});
	const exchange = { calls, results };

	if (!isModelCommand(primary.command)) {
		return {
			accepted: false,
			reason: "command-not-allowed",
			command: primary.command,
			trace,
			exchange,
		};
	}

	if (!callAccepted) {
		return {
			accepted: false,
			reason: "command-rejected",
			command: primary.command,
			trace,
			exchange,
		};
	}

	if (mutation || calls.length > 1 || primary.command !== "completeResponse") {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
			exchange,
		};
	}

	return { accepted: true, trace, exchange };
}
