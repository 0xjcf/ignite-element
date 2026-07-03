import { describe, expect, it } from "vitest";
import { isErr, resolveCall } from "../tools";
import { fromProviderInput, toProviderInputSchema } from "../tools/scalar";
import type { IgniteSchemaObject } from "../types/schema";

// Every tool-calling provider (Anthropic / OpenAI / Ollama) requires OBJECT-shaped
// tool inputs, but the neutral manifest carries SCALAR inputSchema for single-arg
// commands. These pure helpers object-wrap a scalar for the provider and unwrap the
// model's `{ value }` back to the bare value — collision-free because the unwrap is
// gated on the manifest's schema, not a guess.

describe("toProviderInputSchema", () => {
	it("object-wraps a scalar schema under a `value` property", () => {
		const scalar: IgniteSchemaObject = {
			type: "number",
			minimum: 3,
			maximum: 12,
		};
		expect(toProviderInputSchema(scalar)).toEqual({
			type: "object",
			properties: { value: scalar },
			required: ["value"],
			additionalProperties: false,
		});
	});

	it("wraps a scalar enum the same way", () => {
		const scalar: IgniteSchemaObject = {
			type: "string",
			enum: ["red", "blue"],
		};
		expect(toProviderInputSchema(scalar)).toEqual({
			type: "object",
			properties: { value: scalar },
			required: ["value"],
			additionalProperties: false,
		});
	});

	it("passes an object schema through unchanged (same reference)", () => {
		const obj: IgniteSchemaObject = {
			type: "object",
			properties: { name: { type: "string" }, qty: { type: "number" } },
			required: ["name"],
		};
		expect(toProviderInputSchema(obj)).toBe(obj);
	});

	it("passes the no-arg empty-object schema through unchanged", () => {
		const empty: IgniteSchemaObject = { type: "object", properties: {} };
		expect(toProviderInputSchema(empty)).toBe(empty);
	});
});

describe("fromProviderInput", () => {
	it("unwraps { value } to the bare value for a scalar tool schema", () => {
		expect(fromProviderInput({ value: 7 }, { type: "number" })).toBe(7);
		expect(fromProviderInput({ value: "red" }, { type: "string" })).toBe("red");
	});

	it("returns object input unchanged for an object tool schema (collision-safe)", () => {
		// An object command that legitimately has its own `value` field must NOT be
		// unwrapped — the manifest schema (type: object) is what prevents it.
		const input = { value: 7 };
		const schema: IgniteSchemaObject = {
			type: "object",
			properties: { value: { type: "number" } },
			required: ["value"],
		};
		expect(fromProviderInput(input, schema)).toBe(input);
	});

	it("returns input unchanged when the schema is unknown", () => {
		expect(fromProviderInput({ value: 7 }, undefined)).toEqual({ value: 7 });
	});

	it("returns input unchanged for a scalar schema when the input is not a { value } envelope", () => {
		expect(fromProviderInput(7, { type: "number" })).toBe(7);
	});

	it("rejects a scalar envelope with extra keys by leaving it for command validation", () => {
		const input = { value: 7, extra: true };
		const schema: IgniteSchemaObject = { type: "number" };
		const providerInput = fromProviderInput(input, schema);
		const result = resolveCall(
			[{ name: "setLimit", inputSchema: schema, gated: false }],
			"setLimit",
			providerInput,
		);

		expect(providerInput).toBe(input);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.kind).toBe("InvalidInput");
		}
	});
});
