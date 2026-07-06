import type { IgniteSchemaObject } from "../../types/schema";
import { isOk } from "../result";
import { fromProviderInput, toProviderInputSchema } from "../scalar";
import type {
	NeutralManifest,
	NeutralToolCall,
	NeutralToolResult,
	ToolDialect,
} from "../types";

/**
 * OpenAI Chat Completions-compatible tool-use dialect — a pure, SDK-free
 * `ToolDialect`. It translates the neutral manifest to/from the documented
 * OpenAI `tools` / `tool_calls` / `role: "tool"` wire shapes. The same wire
 * format is used by OpenAI-compatible local servers such as Ollama and MLX
 * servers exposed through `/v1/chat/completions`.
 */

/** An OpenAI-compatible function tool definition. */
export type OpenAIChatTool = {
	type: "function";
	function: {
		name: string;
		description?: string;
		parameters: IgniteSchemaObject;
	};
};

/** One OpenAI-compatible assistant `tool_calls` entry. */
export type OpenAIChatToolCall = {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: unknown;
	};
};

/** The slice of an OpenAI-compatible Chat Completions response read here. */
export type OpenAIChatCompletionResponse = {
	choices: Array<{
		message?: {
			tool_calls?: OpenAIChatToolCall[] | null;
			[key: string]: unknown;
		} | null;
		[key: string]: unknown;
	}>;
};

/**
 * An OpenAI-compatible `role: "tool"` message returned on the next model turn.
 * `tool_call_id` correlates it with the originating assistant `tool_calls`
 * entry; `content` carries the JSON-serialized observation or error.
 */
export type OpenAIChatToolResultMessage = {
	role: "tool";
	tool_call_id: string;
	content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isOpenAIChatToolCall(value: unknown): value is OpenAIChatToolCall {
	if (!isRecord(value) || value.type !== "function") {
		return false;
	}
	const fn = value.function;
	return (
		typeof value.id === "string" &&
		isRecord(fn) &&
		typeof fn.name === "string" &&
		"arguments" in fn
	);
}

function parseArguments(args: unknown): unknown {
	if (typeof args !== "string") {
		return args;
	}
	if (args.trim() === "") {
		return {};
	}
	try {
		return JSON.parse(args) as unknown;
	} catch {
		// Keep parse failures as data so `resolveCall` can return InvalidInput
		// instead of the adapter throwing across the provider boundary.
		return args;
	}
}

/**
 * The OpenAI-compatible tool-use dialect. Stateless and provider-SDK-free, so it
 * is a shared singleton.
 */
export const openai: ToolDialect<
	OpenAIChatTool[],
	OpenAIChatCompletionResponse,
	OpenAIChatToolResultMessage
> = {
	tools(manifest: NeutralManifest): OpenAIChatTool[] {
		return manifest.map((tool) => {
			const definition: OpenAIChatTool = {
				type: "function",
				function: {
					name: tool.name,
					parameters: toProviderInputSchema(tool.inputSchema),
				},
			};
			if (tool.description !== undefined) {
				definition.function.description = tool.description;
			}
			return definition;
		});
	},

	toolCalls(
		response: OpenAIChatCompletionResponse,
		manifest: NeutralManifest,
	): NeutralToolCall[] {
		const calls = response.choices[0]?.message?.tool_calls;
		if (!Array.isArray(calls)) {
			return [];
		}
		return calls.flatMap((call) => {
			if (!isOpenAIChatToolCall(call)) {
				return [];
			}
			return [
				{
					id: call.id,
					name: call.function.name,
					input: fromProviderInput(
						parseArguments(call.function.arguments),
						manifest.find((tool) => tool.name === call.function.name)
							?.inputSchema,
					),
				},
			];
		});
	},

	toolResult({ id, result }: NeutralToolResult): OpenAIChatToolResultMessage {
		// OpenAI-compatible chat completions reject a tool message without the
		// originating tool_call_id. The neutral id is optional because the port is
		// provider-agnostic; for this dialect, a missing id is a pairing bug.
		if (id === undefined) {
			throw new Error(
				"openai.toolResult requires a tool_call_id; pass the id from the originating tool_calls entry (call.id from toolCalls()).",
			);
		}
		const payload = (isOk(result) ? result.value : result.error) ?? null;
		let content = "null";
		try {
			content = JSON.stringify(payload) ?? "null";
		} catch {
			content = JSON.stringify(String(payload)) ?? '"[unserializable]"';
		}
		return {
			role: "tool",
			tool_call_id: id,
			content,
		};
	},
};
