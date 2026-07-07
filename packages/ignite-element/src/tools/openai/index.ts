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
	id?: string;
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

function assertOpenAIChatToolCall(
	value: unknown,
	index: number,
): asserts value is OpenAIChatToolCall {
	if (!isRecord(value)) {
		throw new Error(
			`openai.toolCalls expected tool_calls[${index}] to be an object.`,
		);
	}
	if (value.type !== "function") {
		throw new Error(
			`openai.toolCalls expected tool_calls[${index}].type to be "function".`,
		);
	}
	const fn = value.function;
	if (!isRecord(fn)) {
		throw new Error(
			`openai.toolCalls expected tool_calls[${index}].function to be an object.`,
		);
	}
	if (typeof fn.name !== "string" || fn.name.length === 0) {
		throw new Error(
			`openai.toolCalls expected tool_calls[${index}].function.name to be a non-empty string.`,
		);
	}
	if (!("arguments" in fn)) {
		throw new Error(
			`openai.toolCalls expected tool_calls[${index}].function.arguments to be present.`,
		);
	}
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

function describeUnserializablePayload(
	payload: unknown,
	error: unknown,
): Record<string, unknown> {
	const diagnostic: Record<string, unknown> = {
		error: "unserializable tool result",
		reason: error instanceof Error ? error.message : String(error),
		type: Array.isArray(payload) ? "array" : typeof payload,
	};
	if (isRecord(payload)) {
		diagnostic.keys = Object.keys(payload);
	}
	return diagnostic;
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
		const calls = response.choices?.[0]?.message?.tool_calls;
		if (!Array.isArray(calls)) {
			return [];
		}
		const parsedCalls: NeutralToolCall[] = [];
		for (const [index, call] of calls.entries()) {
			try {
				assertOpenAIChatToolCall(call, index);
				const id =
					typeof call.id === "string" && call.id.length > 0
						? call.id
						: `call_${index}`;
				parsedCalls.push({
					id,
					name: call.function.name,
					input: fromProviderInput(
						parseArguments(call.function.arguments),
						manifest.find((tool) => tool.name === call.function.name)
							?.inputSchema,
					),
				});
			} catch {
				// Provider output is untrusted. Drop malformed sibling entries while
				// preserving any valid calls from the same assistant turn.
			}
		}
		return parsedCalls;
	},

	toolResult({ id, result }: NeutralToolResult): OpenAIChatToolResultMessage {
		// OpenAI-compatible chat completions reject a tool message without the
		// originating tool_call_id. The neutral id is optional because the port is
		// provider-agnostic; for this dialect, a missing id is a pairing bug.
		if (typeof id !== "string" || id.length === 0) {
			throw new Error(
				"openai.toolResult requires a tool_call_id; pass the id from the originating tool_calls entry (call.id from toolCalls()).",
			);
		}
		const payload = (isOk(result) ? result.value : result.error) ?? null;
		let content = "null";
		try {
			content = JSON.stringify(payload) ?? "null";
		} catch (error) {
			content = JSON.stringify(describeUnserializablePayload(payload, error));
		}
		return {
			role: "tool",
			tool_call_id: id,
			content,
		};
	},
};
