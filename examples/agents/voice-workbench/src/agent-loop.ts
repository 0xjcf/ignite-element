import { igniteTools, isOk, type NeutralTool } from "ignite-element/tools";

const MODEL_COMMANDS = [
	"createArtifact",
	"reviseArtifact",
	"completeResponse",
] as const;

type ModelCommand = (typeof MODEL_COMMANDS)[number];

export type ModelToolCall = { command: string; input: unknown };
export type ModelResponse = { calls: readonly ModelToolCall[] };
export type ModelRequest = {
	prompt: { channel: "text" | "speech"; text: string };
	tools: readonly NeutralTool[];
	view: unknown;
};
export type WorkbenchModel = (request: ModelRequest) => Promise<ModelResponse>;
export type ModelTurnTrace = { command: string; accepted: boolean };
export type ModelTurnResult =
	| { accepted: true; trace: ModelTurnTrace[] }
	| {
			accepted: false;
			reason: "command-not-allowed";
			command: string;
			trace: ModelTurnTrace[];
	  };

const isModelCommand = (name: string): name is ModelCommand =>
	MODEL_COMMANDS.includes(name as ModelCommand);

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
	const response = await options.model({
		prompt: options.prompt,
		tools: modelManifest,
		view: options.component.getView(),
	});
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
		trace.push({ command: call.command, accepted: isOk(result) });
		if (!isOk(result)) {
			return {
				accepted: false,
				reason: "command-not-allowed",
				command: call.command,
				trace,
			};
		}
	}

	return { accepted: true, trace };
}
