import { igniteTools, isOk } from "ignite-element/tools";
import {
	type AnthropicResponse,
	type AnthropicToolResultBlock,
	anthropic,
} from "ignite-element/tools/anthropic";
import {
	type OpenAIChatCompletionResponse,
	type OpenAIChatToolResultMessage,
	openai,
} from "ignite-element/tools/openai";
import {
	createLocalHomeSession,
	type HomeAgentRuntime,
	type HomeRuntimeFactory,
} from "./home";
import {
	assertOpenAIChatCompletionResponse,
	firstOpenAIChoiceResponse,
	type AnthropicMessage,
	type Model,
	type OpenAICompatibleMessage,
	type OpenAICompatibleModel,
	toOpenAIAssistantMessage,
} from "./model";

/** One tool call the agent made, plus what came back. */
export type AgentTraceEntry = {
	command: string;
	/** The validated input — a scalar command's `{ value }` is already unwrapped. */
	input: unknown;
	ok: boolean;
	/** errors-as-values: the ToolError kind when the call was rejected. */
	errorKind?: string;
	/** The derived view at command-acknowledgement — what the agent grounds on. */
	view?: unknown;
	/** Domain events emitted during the command window (the observation stream). */
	events: string[];
};

export type AgentResult = {
	home: HomeAgentRuntime;
	close(): Promise<void>;
	trace: AgentTraceEntry[];
	finalText: string;
	modelCalls: number;
};

/** A safety bound so a misbehaving model can't loop forever. */
const MAX_TURNS = 12;

/**
 * Drive a fresh smart home through an Anthropic tool-use loop:
 *
 *   getSchema() → anthropic.tools() → [model] → tool_use
 *     → toolCalls() (scalar-unwrap) → run() → toolResult() → repeat
 *
 * The `model` is injected, so the exact same loop runs against the scripted mock
 * (key-free) or the real Anthropic API. This runs headless in pure Node — no DOM,
 * no jsdom — which is the end-to-end proof of the DOM-free agent runtime.
 */
export async function runHomeAgent(
	model: Model,
	userPrompt: string,
	options: { runtimeFactory?: HomeRuntimeFactory } = {},
): Promise<AgentResult> {
	const session = await resolveHomeSession(options.runtimeFactory);
	let completed = false;
	let hasPendingError = false;

	try {
		const { home } = session;
		const { tools, toolCalls, run, toolResult } = igniteTools(home, anthropic);

		const messages: AnthropicMessage[] = [
			{ role: "user", content: userPrompt },
		];
		const trace: AgentTraceEntry[] = [];
		let finalText = "";
		let modelCalls = 0;

		for (let turn = 0; turn < MAX_TURNS; turn++) {
			const response = await model({ tools, messages });
			modelCalls++;
			messages.push({ role: "assistant", content: response.content });

			const calls = toolCalls(response);
			if (calls.length === 0) {
				finalText = textOf(response);
				completed = true;
				return {
					home,
					close: () => session.close(),
					trace,
					finalText,
					modelCalls,
				};
			}

			const resultBlocks: AnthropicToolResultBlock[] = [];
			for (const call of calls) {
				const result = await run(call);
				trace.push({
					command: call.name,
					input: call.input,
					ok: isOk(result),
					errorKind: isOk(result) ? undefined : result.error.kind,
					view: isOk(result) ? result.value.view : undefined,
					events: isOk(result)
						? result.value.events.map((event) => event.type)
						: [],
				});
				resultBlocks.push(toolResult({ id: call.id, name: call.name, result }));
			}
			messages.push({ role: "user", content: resultBlocks });
		}

		throw new Error(
			`runHomeAgent hit MAX_TURNS (${MAX_TURNS}) before producing a final response`,
		);
	} catch (error) {
		hasPendingError = true;
		throw error;
	} finally {
		if (!completed) {
			await closeIncompleteSession(session, hasPendingError);
		}
	}
}

/**
 * Drive a fresh smart home through an OpenAI-compatible Chat Completions
 * tool-call loop. The model can be hosted OpenAI, Ollama, or a local MLX server
 * exposed through `/v1/chat/completions`; this function only consumes the
 * SDK-free `OpenAICompatibleModel` seam.
 */
export async function runHomeOpenAICompatibleAgent(
	model: OpenAICompatibleModel,
	userPrompt: string,
	options: { runtimeFactory?: HomeRuntimeFactory } = {},
): Promise<AgentResult> {
	const session = await resolveHomeSession(options.runtimeFactory);
	let completed = false;
	let hasPendingError = false;

	try {
		const { home } = session;
		const { tools, toolCalls, run, toolResult } = igniteTools(home, openai);

		const messages: OpenAICompatibleMessage[] = [
			{ role: "user", content: userPrompt },
		];
		const trace: AgentTraceEntry[] = [];
		let finalText = "";
		let modelCalls = 0;

		for (let turn = 0; turn < MAX_TURNS; turn++) {
			const response = await model({ tools, messages });
			modelCalls++;
			assertOpenAIChatCompletionResponse(
				response,
				"OpenAI-compatible model response",
			);
			const primaryResponse = firstOpenAIChoiceResponse(response);
			const assistantMessage = toOpenAIAssistantMessage(primaryResponse);
			messages.push(assistantMessage);

			const calls = toolCalls({
				choices: [{ message: { tool_calls: assistantMessage.tool_calls } }],
			});
			if (calls.length === 0) {
				finalText = textOfOpenAI(primaryResponse);
				completed = true;
				return {
					home,
					close: () => session.close(),
					trace,
					finalText,
					modelCalls,
				};
			}

			const resultMessages: OpenAIChatToolResultMessage[] = [];
			for (const call of calls) {
				const result = await run(call);
				trace.push({
					command: call.name,
					input: call.input,
					ok: isOk(result),
					errorKind: isOk(result) ? undefined : result.error.kind,
					view: isOk(result) ? result.value.view : undefined,
					events: isOk(result)
						? result.value.events.map((event) => event.type)
						: [],
				});
				resultMessages.push(
					toolResult({ id: call.id, name: call.name, result }),
				);
			}
			messages.push(...resultMessages);
		}

		throw new Error(
			`runHomeOpenAICompatibleAgent hit MAX_TURNS (${MAX_TURNS}) before producing a final response`,
		);
	} catch (error) {
		hasPendingError = true;
		throw error;
	} finally {
		if (!completed) {
			await closeIncompleteSession(session, hasPendingError);
		}
	}
}

async function closeIncompleteSession(
	session: { close(): Promise<void> },
	hasPendingError: boolean,
): Promise<void> {
	try {
		await session.close();
	} catch (closeError) {
		if (!hasPendingError) {
			throw closeError;
		}
		console.error("smart-home agent cleanup failed:", closeError);
	}
}

/** Concatenate the text blocks of an Anthropic response. */
function textOf(response: AnthropicResponse): string {
	return response.content
		.map((block) =>
			block.type === "text" && typeof block.text === "string" ? block.text : "",
		)
		.filter(Boolean)
		.join("\n");
}

function textOfOpenAI(response: OpenAIChatCompletionResponse): string {
	return response.choices
		.map((choice) =>
			typeof choice.message?.content === "string" ? choice.message.content : "",
		)
		.filter(Boolean)
		.join("\n");
}

async function resolveHomeSession(runtimeFactory?: HomeRuntimeFactory) {
	return await (runtimeFactory?.() ?? createLocalHomeSession());
}
