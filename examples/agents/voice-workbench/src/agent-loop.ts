import {
	igniteTools,
	isOk,
	type NeutralTool,
	type NeutralToolCall,
} from "ignite-element/tools";

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
	tools: readonly NeutralTool[];
	view: unknown;
};
export type WorkbenchModel = (request: ModelRequest) => Promise<ModelResult>;
export type ModelTurnTrace = { command: string; accepted: boolean };
export type ModelTurnResult =
	| { accepted: true; trace: ModelTurnTrace[] }
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

async function recoverModelFailure(
	run: (call: NeutralToolCall) => Promise<{ ok: boolean }>,
	failure: ModelFailureFact,
): Promise<ModelTurnResult> {
	const safeFailure = sanitizedFailure(failure);
	const recovery = await run({
		name: "completeResponse",
		input: { text: safeFailure.message },
	});
	return {
		accepted: false,
		reason: "model-failed",
		failure: safeFailure,
		trace: [{ command: "completeResponse", accepted: recovery.ok }],
	};
}

export async function runModelTurn(options: {
	component: typeof import("./session").component;
	model: WorkbenchModel;
	prompt: { channel: "text" | "speech"; text: string };
}): Promise<ModelTurnResult> {
	await options.component.execute({
		command: "submitPrompt",
		input: { modality: options.prompt.channel, text: options.prompt.text },
	});

	const tools = igniteTools(options.component);
	const modelManifest = tools.manifest.filter((tool) =>
		isModelCommand(tool.name),
	);
	let response: ModelResult;
	try {
		response = await options.model({
			prompt: options.prompt,
			tools: modelManifest,
			view: options.component.getView(),
		});
	} catch {
		return recoverModelFailure(tools.run, {
			kind: "provider",
			message: failureMessage("provider"),
		});
	}
	if (!response.ok) {
		return recoverModelFailure(tools.run, response.error);
	}
	const trace: ModelTurnTrace[] = [];

	for (const call of response.calls) {
		if (!isModelCommand(call.command)) {
			return {
				accepted: false,
				reason: "command-not-allowed",
				command: call.command,
				trace,
			};
		}

		const result = await tools.run({ name: call.command, input: call.input });
		const rejectedByActor =
			isOk(result) &&
			result.value.events.some((event) => event.type === "artifact-rejected");
		const callAccepted = isOk(result) && !rejectedByActor;
		trace.push({ command: call.command, accepted: callAccepted });
		if (!callAccepted) {
			return {
				accepted: false,
				reason: "command-rejected",
				command: call.command,
				trace,
			};
		}
	}

	return { accepted: true, trace };
}
