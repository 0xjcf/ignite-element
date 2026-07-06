import { describe, expect, it } from "vitest";
import type { NeutralManifest, NeutralToolResult } from "../tools";
import { err, ok } from "../tools";
import type { OpenAIChatCompletionResponse } from "../tools/openai";
import { openai } from "../tools/openai";

// Golden neutral <-> OpenAI-compatible fixtures (zero SDK, zero network). The
// adapter is a pure format translator for Chat Completions-compatible tool use:
// OpenAI, Ollama, and MLX servers exposed through /v1/chat/completions.

const manifest: NeutralManifest = [
	{
		name: "setLimit",
		description: "Set the limit.",
		inputSchema: { type: "number", minimum: 3, maximum: 12 },
		gated: false,
	},
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
	{
		name: "increment",
		inputSchema: { type: "object", properties: {} },
		gated: false,
	},
];

describe("openai.tools (neutral manifest -> OpenAI-compatible tool defs)", () => {
	it("object-wraps a scalar command's parameters under `value`", () => {
		const [setLimit] = openai.tools(manifest);
		expect(setLimit).toEqual({
			type: "function",
			function: {
				name: "setLimit",
				description: "Set the limit.",
				parameters: {
					type: "object",
					properties: { value: { type: "number", minimum: 3, maximum: 12 } },
					required: ["value"],
					additionalProperties: false,
				},
			},
		});
	});

	it("passes an object command's parameters through unchanged", () => {
		const addItem = openai.tools(manifest)[1];
		expect(addItem).toEqual({
			type: "function",
			function: {
				name: "addItem",
				description: "Add an item.",
				parameters: {
					type: "object",
					properties: { name: { type: "string" }, qty: { type: "number" } },
					required: ["name"],
				},
			},
		});
	});

	it("emits an empty-object schema for a no-arg command and omits an absent description", () => {
		const increment = openai.tools(manifest)[2];
		expect(increment).toEqual({
			type: "function",
			function: {
				name: "increment",
				parameters: { type: "object", properties: {} },
			},
		});
		expect("description" in increment.function).toBe(false);
	});
});

describe("openai.toolCalls (OpenAI-compatible response -> neutral calls)", () => {
	const response: OpenAIChatCompletionResponse = {
		choices: [
			{
				message: {
					content: "Sure, updating those now.",
					tool_calls: [
						{
							id: "call_1",
							type: "function",
							function: {
								name: "setLimit",
								arguments: JSON.stringify({ value: 7 }),
							},
						},
						{
							id: "call_2",
							type: "function",
							function: {
								name: "addItem",
								arguments: JSON.stringify({ name: "apple", qty: 2 }),
							},
						},
					],
				},
			},
		],
	};

	it("extracts tool_calls, parsing JSON arguments and unwrapping scalar { value }", () => {
		expect(openai.toolCalls(response, manifest)).toEqual([
			{ id: "call_1", name: "setLimit", input: 7 },
			{ id: "call_2", name: "addItem", input: { name: "apple", qty: 2 } },
		]);
	});

	it("returns no calls when the response has no tool_calls", () => {
		const textOnly: OpenAIChatCompletionResponse = {
			choices: [{ message: { content: "No tools needed." } }],
		};
		expect(openai.toolCalls(textOnly, manifest)).toEqual([]);
	});

	it("leaves input untouched for a command not in the manifest", () => {
		const unknown: OpenAIChatCompletionResponse = {
			choices: [
				{
					message: {
						tool_calls: [
							{
								id: "call_x",
								type: "function",
								function: {
									name: "ghost",
									arguments: JSON.stringify({ value: 1 }),
								},
							},
						],
					},
				},
			],
		};
		expect(openai.toolCalls(unknown, manifest)).toEqual([
			{ id: "call_x", name: "ghost", input: { value: 1 } },
		]);
	});

	it("returns invalid JSON arguments as data instead of throwing", () => {
		const invalid: OpenAIChatCompletionResponse = {
			choices: [
				{
					message: {
						tool_calls: [
							{
								id: "call_bad",
								type: "function",
								function: { name: "setLimit", arguments: "{not-json" },
							},
						],
					},
				},
			],
		};
		expect(openai.toolCalls(invalid, manifest)).toEqual([
			{ id: "call_bad", name: "setLimit", input: "{not-json" },
		]);
	});

	it("accepts structured arguments from local OpenAI-compatible servers", () => {
		const structured: OpenAIChatCompletionResponse = {
			choices: [
				{
					message: {
						tool_calls: [
							{
								id: "call_object",
								type: "function",
								function: {
									name: "addItem",
									arguments: { name: "pear", qty: 3 },
								},
							},
						],
					},
				},
			],
		};
		expect(openai.toolCalls(structured, manifest)).toEqual([
			{ id: "call_object", name: "addItem", input: { name: "pear", qty: 3 } },
		]);
	});

	it("skips malformed tool call entries instead of throwing", () => {
		const malformed: OpenAIChatCompletionResponse = {
			choices: [
				{
					message: {
						tool_calls: [
							{ id: "missing_function", type: "function" },
							{
								id: "call_valid",
								type: "function",
								function: {
									name: "setLimit",
									arguments: JSON.stringify({ value: 8 }),
								},
							},
						] as unknown as NonNullable<
							NonNullable<
								OpenAIChatCompletionResponse["choices"][number]["message"]
							>["tool_calls"]
						>,
					},
				},
			],
		};
		expect(openai.toolCalls(malformed, manifest)).toEqual([
			{ id: "call_valid", name: "setLimit", input: 8 },
		]);
	});
});

describe("openai.toolResult (neutral result -> OpenAI-compatible tool message)", () => {
	it("renders a successful observation as a role=tool message", () => {
		const result: NeutralToolResult = {
			id: "call_1",
			name: "setLimit",
			result: ok({
				snapshot: { count: 7 },
				view: { atLimit: false },
				events: [],
			}),
		};
		expect(openai.toolResult(result)).toEqual({
			role: "tool",
			tool_call_id: "call_1",
			content: JSON.stringify({
				snapshot: { count: 7 },
				view: { atLimit: false },
				events: [],
			}),
		});
	});

	it("renders a ToolError into the role=tool message content", () => {
		const error = {
			kind: "InvalidInput" as const,
			name: "setLimit",
			issues: ["expected a number"],
		};
		const result: NeutralToolResult = {
			id: "call_2",
			name: "setLimit",
			result: err(error),
		};
		expect(openai.toolResult(result)).toEqual({
			role: "tool",
			tool_call_id: "call_2",
			content: JSON.stringify(error),
		});
	});

	it("renders undefined observations as JSON null content", () => {
		const result: NeutralToolResult = {
			id: "call_empty",
			name: "increment",
			result: ok(undefined as never),
		};
		expect(openai.toolResult(result)).toEqual({
			role: "tool",
			tool_call_id: "call_empty",
			content: "null",
		});
	});

	it("throws when the neutral result has no id (OpenAI requires a tool_call_id)", () => {
		const result: NeutralToolResult = {
			name: "setLimit",
			result: ok({
				snapshot: { count: 7 },
				view: { atLimit: false },
				events: [],
			}),
		};
		expect(() => openai.toolResult(result)).toThrow(/tool_call_id/);
	});
});
