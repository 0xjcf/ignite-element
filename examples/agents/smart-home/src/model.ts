import type {
	AnthropicResponse,
	AnthropicTool,
} from "ignite-element/tools/anthropic";
import type {
	OpenAIChatCompletionResponse,
	OpenAIChatTool,
	OpenAIChatToolCall,
} from "ignite-element/tools/openai";

/**
 * One Anthropic Messages turn — the subset the loop sends back. `content` is the
 * user prompt string on the first turn, then the assistant's content blocks and
 * our `tool_result` blocks on subsequent turns.
 */
export type AnthropicMessage = {
	role: "user" | "assistant";
	content: unknown;
};

/**
 * The pluggable model seam: the loop calls this; the implementation decides where
 * the response comes from. Swap the real model for the scripted one without
 * touching the loop.
 */
export type Model = (request: {
	tools: AnthropicTool[];
	messages: AnthropicMessage[];
}) => Promise<AnthropicResponse>;

export type OpenAICompatibleMessage =
	| { role: "system" | "user"; content: string }
	| {
			role: "assistant";
			content?: string | null;
			tool_calls?: OpenAIChatToolCall[];
	  }
	| { role: "tool"; tool_call_id: string; content: string };

export type OpenAICompatibleModel = (request: {
	tools: OpenAIChatTool[];
	messages: OpenAICompatibleMessage[];
}) => Promise<OpenAIChatCompletionResponse>;

/**
 * A deterministic, key-free model: replays a fixed script of responses. Lets the
 * whole loop run and be asserted with zero network — the manual-validation
 * harness for the headless runtime + the Anthropic adapter, encoded as a test.
 */
export function scriptedModel(script: AnthropicResponse[]): Model {
	let turn = 0;
	return async () => {
		const response = script[turn++];
		if (!response) {
			throw new Error("scriptedModel exhausted its scripted responses");
		}
		return response;
	};
}

export function scriptedOpenAICompatibleModel(
	script: OpenAIChatCompletionResponse[],
): OpenAICompatibleModel {
	let turn = 0;
	return async () => {
		const response = script[turn++];
		if (!response) {
			throw new Error(
				"scriptedOpenAICompatibleModel exhausted its scripted responses",
			);
		}
		return response;
	};
}

export function openAICompatibleModel(options: {
	baseUrl?: string;
	apiKey?: string;
	model?: string;
	system?: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
}): OpenAICompatibleModel {
	const baseUrl = stripTrailingSlash(
		options.baseUrl ?? "http://127.0.0.1:8080/v1",
	);
	const endpoint = `${baseUrl}/chat/completions`;
	const model = options.model ?? "mlx-local";
	const fetchImpl = options.fetch ?? fetch;
	const timeoutMs = options.timeoutMs ?? 30_000;

	return async ({ tools, messages }) => {
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		if (options.apiKey) {
			headers.authorization = `Bearer ${options.apiKey}`;
		}

		const bodyMessages = options.system
			? [{ role: "system" as const, content: options.system }, ...messages]
			: messages;
		const body: {
			model: string;
			messages: OpenAICompatibleMessage[];
			tools?: OpenAIChatTool[];
		} = {
			model,
			messages: bodyMessages,
		};
		if (tools.length > 0) {
			body.tools = tools;
		}

		let response: Response;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		try {
			response = await fetchImpl(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeoutId);
			if (controller.signal.aborted || isAbortError(error)) {
				throw openAICompatibleTimeoutError(baseUrl, timeoutMs);
			}
			throw new Error(
				`Could not reach OpenAI-compatible server at ${baseUrl}. Verify the server is running and reachable (for a local MLX server: \`python -m mlx_lm.server --model <model> --port 8080\`). Original error: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		try {
			if (!response.ok) {
				const rawDetail = await response.text().catch((error) => {
					if (controller.signal.aborted || isAbortError(error)) {
						throw error;
					}
					return "";
				});
				const detail =
					rawDetail.length > 1_000
						? `${rawDetail.slice(0, 1_000)}...`
						: rawDetail;
				throw new Error(
					`OpenAI-compatible server at ${endpoint} returned ${response.status} ${response.statusText}${
						detail ? `: ${detail}` : ""
					}`,
				);
			}

			let payload: unknown;
			try {
				payload = await response.json();
			} catch (error) {
				if (controller.signal.aborted || isAbortError(error)) {
					throw openAICompatibleTimeoutError(baseUrl, timeoutMs);
				}
				throw new Error(
					`OpenAI-compatible server at ${endpoint} returned invalid JSON. Original error: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			assertOpenAIChatCompletionResponse(payload, endpoint);
			return payload;
		} catch (error) {
			if (controller.signal.aborted || isAbortError(error)) {
				throw openAICompatibleTimeoutError(baseUrl, timeoutMs);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	};
}

function stripTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

export function assertOpenAIChatCompletionResponse(
	value: unknown,
	source = "OpenAI-compatible response",
): asserts value is OpenAIChatCompletionResponse {
	if (!isRecord(value)) {
		throw new Error(`${source} was malformed: expected an object response.`);
	}
	if (!Array.isArray(value.choices) || value.choices.length === 0) {
		throw new Error(
			`${source} was malformed: choices must be a non-empty array.`,
		);
	}
	for (const choice of value.choices) {
		if (!isRecord(choice)) {
			throw new Error(
				`${source} was malformed: each choice must be an object.`,
			);
		}
		const message = choice.message;
		if (!isRecord(message)) {
			throw new Error(
				`${source} was malformed: choice.message must be an object.`,
			);
		}
		if (message.role !== "assistant") {
			throw new Error(
				`${source} was malformed: choice.message.role must be "assistant".`,
			);
		}
		const toolCalls = message.tool_calls;
		const content = message.content;
		const hasTextContent =
			typeof content === "string" && content.trim().length > 0;
		if (content != null && typeof content !== "string") {
			throw new Error(
				`${source} was malformed: choice.message.content must be a string when present.`,
			);
		}
		if (
			toolCalls == null ||
			(Array.isArray(toolCalls) && toolCalls.length === 0)
		) {
			if (!hasTextContent) {
				throw new Error(
					`${source} was malformed: assistant messages must include content or tool_calls.`,
				);
			}
			continue;
		}
		if (!Array.isArray(toolCalls)) {
			throw new Error(
				`${source} was malformed: message.tool_calls must be valid function tool calls.`,
			);
		}
		if (!toolCalls.some(isOpenAIToolCall) && !hasTextContent) {
			throw new Error(
				`${source} was malformed: message.tool_calls must include at least one valid function tool call when content is empty.`,
			);
		}
	}
}

export function firstOpenAIChoiceResponse(
	response: OpenAIChatCompletionResponse,
): OpenAIChatCompletionResponse {
	const choice = response.choices[0];
	if (!choice) {
		throw new Error(
			"OpenAI-compatible model response was malformed: choices must be a non-empty array.",
		);
	}
	return { choices: [normalizeOpenAIChoice(choice)] };
}

export function toOpenAIAssistantMessage(
	response: OpenAIChatCompletionResponse,
): Extract<OpenAICompatibleMessage, { role: "assistant" }> {
	const choice = response.choices[0];
	if (!isRecord(choice)) {
		throw new Error(
			"OpenAI-compatible model response was malformed: first choice must be an object.",
		);
	}
	const message = choice.message;
	if (!isRecord(message)) {
		throw new Error(
			"OpenAI-compatible model response was malformed: choice.message must be an object.",
		);
	}
	const content = message.content;
	const toolCalls = message.tool_calls;
	const normalizedToolCalls = Array.isArray(toolCalls)
		? normalizeOpenAIToolCalls(toolCalls.filter(isOpenAIToolCall))
		: undefined;
	return {
		role: "assistant",
		content: typeof content === "string" ? content : null,
		tool_calls:
			normalizedToolCalls && normalizedToolCalls.length > 0
				? normalizedToolCalls
				: undefined,
	};
}

function normalizeOpenAIChoice(
	choice: OpenAIChatCompletionResponse["choices"][number],
): OpenAIChatCompletionResponse["choices"][number] {
	const message = choice.message;
	if (!isRecord(message) || !Array.isArray(message.tool_calls)) {
		return choice;
	}
	const validToolCalls = message.tool_calls.filter(isOpenAIToolCall);

	return {
		...choice,
		message: {
			...message,
			tool_calls: normalizeOpenAIToolCalls(validToolCalls),
		},
	};
}

function normalizeOpenAIToolCalls(
	toolCalls: OpenAIChatToolCall[],
): OpenAIChatToolCall[] {
	return toolCalls.map((call, index) => ({
		...call,
		id:
			typeof call.id === "string" && call.id.length > 0
				? call.id
				: `call_${index}`,
		function: {
			...call.function,
			arguments: stringifyOpenAIArguments(call.function.arguments),
		},
	}));
}

function stringifyOpenAIArguments(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (value == null) {
		return "{}";
	}
	try {
		return JSON.stringify(value) ?? "null";
	} catch {
		return JSON.stringify(String(value)) ?? '"[unserializable]"';
	}
}

function isOpenAIToolCall(value: unknown): value is OpenAIChatToolCall {
	if (!isRecord(value) || value.type !== "function") {
		return false;
	}
	const fn = value.function;
	return (
		(value.id == null || typeof value.id === "string") &&
		isRecord(fn) &&
		typeof fn.name === "string" &&
		(!("arguments" in fn) ||
			fn.arguments == null ||
			typeof fn.arguments === "string" ||
			isRecord(fn.arguments))
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function openAICompatibleTimeoutError(
	baseUrl: string,
	timeoutMs: number,
): Error {
	return new Error(
		`OpenAI-compatible server at ${baseUrl} timed out after ${timeoutMs}ms.`,
	);
}

/**
 * The real Anthropic model. The SDK is imported lazily through a variable
 * specifier so this example typechecks and the scripted path runs **without**
 * `@anthropic-ai/sdk` installed; install it to use this path:
 *
 *   npm install @anthropic-ai/sdk
 */
export function anthropicModel(options: {
	apiKey: string;
	model?: string;
	system?: string;
	maxTokens?: number;
}): Model {
	return async ({ tools, messages }) => {
		const specifier = "@anthropic-ai/sdk";
		const sdk = (await import(specifier)) as {
			default: new (opts: {
				apiKey: string;
			}) => {
				messages: {
					create(body: {
						model: string;
						max_tokens: number;
						system?: string;
						tools: AnthropicTool[];
						messages: AnthropicMessage[];
					}): Promise<AnthropicResponse>;
				};
			};
		};
		const client = new sdk.default({ apiKey: options.apiKey });
		return client.messages.create({
			model: options.model ?? "claude-sonnet-4-6",
			max_tokens: options.maxTokens ?? 1024,
			system:
				options.system ??
				"You control a smart home through tools. Take the requested actions, then briefly confirm what you did.",
			tools,
			messages,
		});
	};
}
