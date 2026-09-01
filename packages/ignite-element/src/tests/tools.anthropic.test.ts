import { describe, expect, it } from "vitest";
import type { NeutralManifest, NeutralToolResult } from "../tools";
import { err, ok } from "../tools";
import type { AnthropicResponse } from "../tools/anthropic";
import { anthropic } from "../tools/anthropic";

// Golden neutral <-> Anthropic fixtures (zero SDK, zero network). The adapter is
// a pure format translator: it maps the neutral manifest to Anthropic tool defs,
// extracts + unwraps `tool_use` blocks, and renders `tool_result` blocks. The
// SCALAR command exercises the Option D object-wrap/unwrap (a single-arg command
// is `{ value }`-wrapped for the model and unwrapped on the way back).

const manifest: NeutralManifest = [
	// scalar-input command: object-wrapped under `value` for the provider
	{
		name: "setLimit",
		description: "Set the limit.",
		inputSchema: { type: "number", minimum: 3, maximum: 12 },
		gated: false,
	},
	// object-input command: passed through verbatim
	{
		name: "addItem",
		description: "Add an item.",
		inputSchema: {
			type: "object",
			properties: { name: { type: "string" }, qty: { type: "number" } },
			required: ["name"],
		},
		gated: false,
	},
	// no-arg command, no description: empty-object schema, `description` omitted
	{
		name: "increment",
		inputSchema: { type: "object", properties: {} },
		gated: false,
	},
];

describe("anthropic.tools (neutral manifest -> Anthropic tool defs)", () => {
	it("object-wraps a scalar command's input schema under `value`", () => {
		const [setLimit] = anthropic.tools(manifest);
		expect(setLimit).toEqual({
			name: "setLimit",
			description: "Set the limit.",
			input_schema: {
				type: "object",
				properties: { value: { type: "number", minimum: 3, maximum: 12 } },
				required: ["value"],
				additionalProperties: false,
			},
		});
	});

	it("passes an object command's input schema through unchanged", () => {
		const addItem = anthropic.tools(manifest)[1];
		expect(addItem).toEqual({
			name: "addItem",
			description: "Add an item.",
			input_schema: {
				type: "object",
				properties: { name: { type: "string" }, qty: { type: "number" } },
				required: ["name"],
			},
		});
	});

	it("emits an empty-object schema for a no-arg command and omits an absent description", () => {
		const increment = anthropic.tools(manifest)[2];
		expect(increment).toEqual({
			name: "increment",
			input_schema: { type: "object", properties: {} },
		});
		expect("description" in increment).toBe(false);
	});
});

describe("anthropic.toolCalls (Anthropic response -> neutral calls)", () => {
	const response: AnthropicResponse = {
		content: [
			// non-tool blocks are ignored
			{ type: "text", text: "Sure, updating those now." },
			{
				type: "tool_use",
				id: "toolu_1",
				name: "setLimit",
				input: { value: 7 },
			},
			{
				type: "tool_use",
				id: "toolu_2",
				name: "addItem",
				input: { name: "apple", qty: 2 },
			},
		],
	};

	it("extracts tool_use blocks, unwrapping a scalar command's { value }", () => {
		expect(anthropic.toolCalls(response, manifest)).toEqual([
			{ id: "toolu_1", name: "setLimit", input: 7 },
			{ id: "toolu_2", name: "addItem", input: { name: "apple", qty: 2 } },
		]);
	});

	it("returns no calls when the response carries only non-tool content", () => {
		const textOnly: AnthropicResponse = {
			content: [{ type: "text", text: "No tools needed." }],
		};
		expect(anthropic.toolCalls(textOnly, manifest)).toEqual([]);
	});

	it("leaves input untouched for a command not in the manifest", () => {
		const unknown: AnthropicResponse = {
			content: [
				{ type: "tool_use", id: "toolu_x", name: "ghost", input: { value: 1 } },
			],
		};
		expect(anthropic.toolCalls(unknown, manifest)).toEqual([
			{ id: "toolu_x", name: "ghost", input: { value: 1 } },
		]);
	});
});

describe("anthropic.toolResult (neutral result -> Anthropic tool_result block)", () => {
	it("renders a successful observation as a non-error block", () => {
		const result: NeutralToolResult = {
			id: "toolu_1",
			name: "setLimit",
			result: ok({
				snapshot: { count: 7 },
				states: { atLimit: false },
				events: [],
			}),
		};
		expect(anthropic.toolResult(result)).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_1",
			content: JSON.stringify({
				snapshot: { count: 7 },
				states: { atLimit: false },
				events: [],
			}),
			is_error: false,
		});
	});

	it("renders a ToolError as an is_error block carrying the serialized error", () => {
		const error = {
			kind: "InvalidInput" as const,
			name: "setLimit",
			issues: ["expected a number"],
		};
		const result: NeutralToolResult = {
			id: "toolu_2",
			name: "setLimit",
			result: err(error),
		};
		expect(anthropic.toolResult(result)).toEqual({
			type: "tool_result",
			tool_use_id: "toolu_2",
			content: JSON.stringify(error),
			is_error: true,
		});
	});

	it("throws when the neutral result has no id (Anthropic requires a tool_use_id)", () => {
		const result: NeutralToolResult = {
			name: "setLimit",
			result: ok({
				snapshot: { count: 7 },
				states: { atLimit: false },
				events: [],
			}),
		};
		expect(() => anthropic.toolResult(result)).toThrow(/tool_use_id/);
	});
});
