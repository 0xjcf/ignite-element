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
 * Anthropic Messages tool-use dialect — a pure, SDK-free `ToolDialect`. It
 * translates the neutral manifest to/from the documented Anthropic Messages
 * wire shapes; the consumer brings `@anthropic-ai/sdk` (or `fetch`) and runs the
 * model loop. The structural wire types below are the minimal subset igniteTools
 * touches, not a vendored copy of the SDK's types.
 *
 * @see https://docs.anthropic.com/en/api/messages — tool use
 */

/**
 * An Anthropic tool definition. `input_schema` is always an object schema; a
 * scalar command is object-wrapped by {@link toProviderInputSchema} (Option D).
 */
export type AnthropicTool = {
	name: string;
	description?: string;
	input_schema: IgniteSchemaObject;
};

/** An Anthropic `tool_use` content block (the model's request to call a tool). */
export type AnthropicToolUseBlock = {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
};

/** One block of an Anthropic Messages response `content` array. */
export type AnthropicContentBlock =
	| AnthropicToolUseBlock
	| { type: string; [key: string]: unknown };

/** The slice of an Anthropic Messages response the dialect reads tool calls from. */
export type AnthropicResponse = {
	content: AnthropicContentBlock[];
};

/**
 * An Anthropic `tool_result` content block, returned to the model on the next
 * turn. `tool_use_id` correlates it with the originating `tool_use` block (always
 * present in an Anthropic response, so always required here); `content` is the
 * JSON-serialized observation (or error); `is_error` flags a failed call so the
 * model can recover.
 */
export type AnthropicToolResultBlock = {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error: boolean;
};

/**
 * The Anthropic tool-use dialect. Stateless and provider-SDK-free, so it is a
 * shared singleton.
 */
export const anthropic: ToolDialect<
	AnthropicTool[],
	AnthropicResponse,
	AnthropicToolResultBlock
> = {
	tools(manifest: NeutralManifest): AnthropicTool[] {
		return manifest.map((tool) => {
			const definition: AnthropicTool = {
				name: tool.name,
				input_schema: toProviderInputSchema(tool.inputSchema),
			};
			if (tool.description !== undefined) {
				definition.description = tool.description;
			}
			return definition;
		});
	},

	toolCalls(
		response: AnthropicResponse,
		manifest: NeutralManifest,
	): NeutralToolCall[] {
		return response.content
			.filter(
				(block): block is AnthropicToolUseBlock => block.type === "tool_use",
			)
			.map((block) => ({
				id: block.id,
				name: block.name,
				input: fromProviderInput(
					block.input,
					manifest.find((tool) => tool.name === block.name)?.inputSchema,
				),
			}));
	},

	toolResult({ id, result }: NeutralToolResult): AnthropicToolResultBlock {
		// Anthropic rejects a tool_result without a tool_use_id. The neutral id is
		// optional (provider-agnostic), but for Anthropic it always originates from
		// a tool_use block via toolCalls() — a missing id is a pairing bug, not an
		// expected error, so fail fast rather than emit an invalid block.
		if (id === undefined) {
			throw new Error(
				"anthropic.toolResult requires a tool_use_id; pass the id from the originating tool_use block (call.id from toolCalls()).",
			);
		}
		return {
			type: "tool_result",
			tool_use_id: id,
			content: JSON.stringify(isOk(result) ? result.value : result.error),
			is_error: !isOk(result),
		};
	},
};
