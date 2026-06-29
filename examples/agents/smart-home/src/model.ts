import type {
	AnthropicResponse,
	AnthropicTool,
} from "ignite-element/tools/anthropic";

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
