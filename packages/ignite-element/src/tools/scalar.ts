import type { IgniteSchemaObject } from "../types/schema";

/**
 * Shared, provider-agnostic scalar/object bridging for `ToolDialect` adapters.
 *
 * Every tool-calling provider (Anthropic / OpenAI+Codex / Ollama) requires
 * tool inputs to be JSON-Schema **objects** and returns the model's arguments as
 * an object. The neutral manifest, however, carries the command's *true* schema —
 * which is **scalar** for a single-arg command (`createShipment(id: string)` →
 * `{ type: "string" }`). So an adapter object-wraps a scalar for the model and
 * unwraps the returned `{ value: … }` back to the bare value before it reaches
 * `resolveCall`. Keeping this in one pure place means anthropic/openai/ollama all
 * share it, and the manifest stays scalar-honest (the wrapping lives only at the
 * provider boundary).
 */

/** The property a scalar command's single value is wrapped under for the model. */
const SCALAR_KEY = "value";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Render a command's neutral input schema as a provider-acceptable **object**
 * schema. Object/no-arg schemas pass through unchanged (same reference); a scalar
 * schema is wrapped under `value`.
 */
export function toProviderInputSchema(
	schema: IgniteSchemaObject,
): IgniteSchemaObject {
	if (schema.type === "object") {
		return schema;
	}
	return {
		type: "object",
		properties: { [SCALAR_KEY]: schema },
		required: [SCALAR_KEY],
		additionalProperties: false,
	};
}

/**
 * Reverse {@link toProviderInputSchema}: a scalar command's model input arrives as
 * `{ value: x }`; unwrap it to `x` so `resolveCall` validates against the true
 * scalar schema. Unwrapping is gated on the manifest schema being scalar (not a
 * guess on the shape), so an object command that legitimately carries a `value`
 * field is never unwrapped.
 */
export function fromProviderInput(
	input: unknown,
	schema: IgniteSchemaObject | undefined,
): unknown {
	if (
		schema !== undefined &&
		schema.type !== "object" &&
		isPlainObject(input) &&
		Object.keys(input).length === 1 &&
		SCALAR_KEY in input
	) {
		return input[SCALAR_KEY];
	}
	return input;
}
