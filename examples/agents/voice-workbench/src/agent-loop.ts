import { igniteTools, isOk, type NeutralTool } from "ignite-element/tools";
import { createConversationSession } from "./session";

export type ModelToolCall = {
	command: string;
	input: unknown;
};

export type ModelResponse = { calls: readonly ModelToolCall[] };

export type ModelRequest = {
	prompt: { channel: "text" | "speech"; text: string };
	tools: readonly NeutralTool[];
	view: unknown;
};

export type WorkbenchModel = {
	(request: ModelRequest): Promise<ModelResponse>;
	requests?: readonly ModelRequest[];
};

export type ScriptedModel = WorkbenchModel & {
	requests: ModelRequest[];
};

export type WorkbenchReceiveResult =
	| { accepted: true }
	| {
			accepted: false;
			reason: "command-not-allowed";
			command: string;
	  };

export type WorkbenchAgent = {
	runtime: ReturnType<typeof createConversationSession>["runtime"];
	trace: Array<{ command: string; accepted: boolean }>;
	receive(prompt: {
		channel: "text" | "speech";
		text: string;
	}): Promise<WorkbenchReceiveResult>;
	close(): void;
};

const isInputSchema = (value: unknown): value is NeutralTool["inputSchema"] =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	"type" in value;

export function createScriptedModel(
	responses: readonly ModelResponse[],
): ScriptedModel {
	const requests: ModelRequest[] = [];
	const model = async (request: ModelRequest): Promise<ModelResponse> => {
		requests.push(request);
		return responses[requests.length - 1] ?? { calls: [] };
	};
	return Object.assign(model, { requests });
}

export function createWorkbenchAgent(options: {
	sessionId: string;
	model: WorkbenchModel;
}): WorkbenchAgent {
	const session = createConversationSession(options.sessionId);
	const trace: Array<{ command: string; accepted: boolean }> = [];

	return {
		runtime: session.runtime,
		trace,
		async receive(prompt: { channel: "text" | "speech"; text: string }) {
			session.recordPrompt(prompt.channel, prompt.text);
			const schema = session.runtime.getSchema();
			const allTools = Object.keys(schema.commands)
				.sort()
				.map((name) => {
					const metadata = schema.commands[name];
					return {
						name,
						inputSchema: isInputSchema(metadata?.input)
							? metadata.input
							: {
									type: "object" as const,
									properties: {},
								},
						gated: metadata?.gated === true,
					};
				});
			const response = await options.model({
				prompt,
				tools: allTools,
				view: session.runtime.getView(),
			});
			const tools = igniteTools(session.runtime);

			for (const call of response.calls) {
				if (call.command !== "completeResponse") {
					session.recordProposal(call.command);
				}
				const result = await tools.run({
					name: call.command,
					input: call.input,
				});
				trace.push({ command: call.command, accepted: isOk(result) });
				if (!isOk(result)) {
					return {
						accepted: false as const,
						reason: "command-not-allowed" as const,
						command: call.command,
					};
				}
			}

			return { accepted: true as const };
		},
		close: session.close,
	};
}
