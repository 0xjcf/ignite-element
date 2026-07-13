import type { NeutralManifest } from "ignite-element/tools";

const MODEL_COMMANDS = [
	"createArtifact",
	"reviseArtifact",
	"completeResponse",
] as const;

type ModelCommand = (typeof MODEL_COMMANDS)[number];

export type ModelToolCall = { command: string; input: unknown };
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
};
export type ModelTurnTrace = { command: string; accepted: boolean };
export type ModelTurnResult =
	| { accepted: true; trace: ModelTurnTrace[] }
	| {
			accepted: false;
			reason: "prompt-rejected" | "response-incomplete";
			trace: ModelTurnTrace[];
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
	  };

const isModelCommand = (name: string): name is ModelCommand =>
	MODEL_COMMANDS.includes(name as ModelCommand);

export const modelTools = (manifest: NeutralManifest): NeutralManifest =>
	manifest.filter((tool) => isModelCommand(tool.name));

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
	command: "completeResponse",
	input: { text: message },
});

/**
 * A pure protocol for one admitted model turn. The browser composition root
 * executes each yielded call through Ignite and returns only its acceptance.
 */
export function* modelTurn(
	response: ModelResult,
): Generator<ModelToolCall, ModelTurnResult, boolean> {
	const trace: ModelTurnTrace[] = [];
	if (!response.ok) {
		const failure = sanitizedFailure(response.error);
		const accepted = yield recoveryCall(failure.message);
		trace.push({ command: "completeResponse", accepted });
		return {
			accepted: false,
			reason: "model-failed",
			failure,
			trace,
		};
	}
	let responseCompleted = false;
	let artifactMutationSeen = false;

	for (const call of response.calls) {
		if (!isModelCommand(call.command)) {
			const accepted = yield recoveryCall(
				"The model proposed a command that is not allowed. Refine the prompt and try again.",
			);
			trace.push({ command: "completeResponse", accepted });
			return {
				accepted: false,
				reason: "command-not-allowed",
				command: call.command,
				trace,
			};
		}
		const artifactMutation =
			call.command === "createArtifact" || call.command === "reviseArtifact";
		if (artifactMutation && artifactMutationSeen) continue;
		if (artifactMutation) artifactMutationSeen = true;

		const callAccepted = yield call;
		trace.push({ command: call.command, accepted: callAccepted });
		if (!callAccepted) {
			const recoveryAccepted = yield recoveryCall(
				"The actor rejected the proposed command. Refine the prompt and try again.",
			);
			trace.push({
				command: "completeResponse",
				accepted: recoveryAccepted,
			});
			return {
				accepted: false,
				reason: "command-rejected",
				command: call.command,
				trace,
			};
		}
		if (call.command === "completeResponse") {
			responseCompleted = true;
		}
	}

	if (!responseCompleted) {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
		};
	}

	return { accepted: true, trace };
}
