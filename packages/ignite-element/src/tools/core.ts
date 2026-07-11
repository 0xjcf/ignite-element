import type { IgniteAgentSchema, IgniteSchemaObject } from "../types/schema";
import { err, ok, type Result } from "./result";
import type {
	AvailabilityPredicate,
	NeutralManifest,
	NeutralTool,
	Route,
	ToolError,
} from "./types";

// The JSON-Schema-shaped input a no-arg command advertises: "no parameters".
const emptyObjectSchema = (): IgniteSchemaObject => ({
	type: "object",
	properties: {},
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoArgSchema(schema: IgniteSchemaObject): boolean {
	if (schema.type !== "object") {
		return false;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	return (
		Object.keys(properties).length === 0 &&
		(!Array.isArray(schema.required) || schema.required.length === 0)
	);
}

function normalizeRouteInput(
	schema: IgniteSchemaObject,
	input: unknown,
): { input?: unknown } {
	if (isNoArgSchema(schema)) {
		return {};
	}

	if (input === undefined && "default" in schema) {
		return { input: schema.default };
	}

	return { input };
}

// A command's input schema is its `input` metadata when present (scalar OR
// object — mirrored verbatim), else the empty-object schema.
function toInputSchema(metadata: IgniteSchemaObject): IgniteSchemaObject {
	const input = metadata.input;
	return isPlainObject(input)
		? (input as IgniteSchemaObject)
		: emptyObjectSchema();
}

/**
 * Pure: `getSchema()` → neutral tool manifest, sorted by name. Gated commands
 * are omitted when an availability predicate reports them currently
 * unavailable; without a predicate, every command is offered.
 *
 * Only `schema.commands` is read, so the snapshot/view types are left open —
 * any `getSchema()` return is accepted regardless of its state/view shape.
 */
export function buildManifest(
	schema: IgniteAgentSchema<unknown, Record<string, unknown>>,
	canExecute?: AvailabilityPredicate,
): NeutralManifest {
	const isAvailable = canExecute ?? (() => true);
	const manifest: NeutralManifest = [];

	for (const name of Object.keys(schema.commands).sort()) {
		const metadata = schema.commands[name];
		const gated = metadata.gated === true;
		if (gated && !isAvailable(name)) {
			continue;
		}

		const tool: NeutralTool = {
			name,
			inputSchema: toInputSchema(metadata),
			gated,
		};
		if (typeof metadata.description === "string") {
			tool.description = metadata.description;
		}
		manifest.push(tool);
	}

	return manifest;
}

/**
 * Pure: validate a model-supplied input against a command's schema and route it
 * to `{ command, input? }`. Errors are returned as values — `UnknownCommand`
 * (not in the manifest), `Unavailable` (gated and currently unavailable — the
 * availability may have changed since the manifest was built), or `InvalidInput`
 * (fails the input schema). Never throws.
 */
export function resolveCall(
	manifest: NeutralManifest,
	name: string,
	input: unknown,
	canExecute?: AvailabilityPredicate,
): Result<Route, ToolError> {
	const tool = manifest.find((candidate) => candidate.name === name);
	if (!tool) {
		return err({ kind: "UnknownCommand", name });
	}

	if (tool.gated && canExecute && !canExecute(name)) {
		return err({ kind: "Unavailable", name });
	}

	const issues = validateToolInputValue(tool.inputSchema, input, "input");
	if (issues.length > 0) {
		return err({ kind: "InvalidInput", name, issues });
	}

	return ok({ command: name, ...normalizeRouteInput(tool.inputSchema, input) });
}

/**
 * Minimal structural validation covering the command-input metadata vocabulary
 * (number/string/boolean/enum/object/array + their declared constraints). Pure;
 * returns the list of issues (empty = valid). Not a full JSON-Schema validator —
 * scoped to the shapes `command.*` can produce.
 */
export function validateToolInputValue(
	schema: IgniteSchemaObject,
	value: unknown,
	path: string,
): string[] {
	const type = schema.type;

	if (value === undefined) {
		// Absent input is acceptable when a default exists, or for an object schema
		// with no required properties (the no-arg command case).
		if ("default" in schema) {
			return [];
		}
		if (type === "object") {
			return validateToolInputValue(schema, {}, path);
		}
		return [`${path}: expected ${String(type)} but received undefined`];
	}

	switch (type) {
		case "number": {
			if (typeof value !== "number" || Number.isNaN(value)) {
				return [`${path}: expected number`];
			}
			const issues: string[] = [];
			if (typeof schema.minimum === "number" && value < schema.minimum) {
				issues.push(`${path}: below minimum ${schema.minimum}`);
			}
			if (typeof schema.maximum === "number" && value > schema.maximum) {
				issues.push(`${path}: above maximum ${schema.maximum}`);
			}
			if (typeof schema.multipleOf === "number" && schema.multipleOf !== 0) {
				// Compare the quotient to its nearest integer with a tolerance —
				// `value % multipleOf` is unreliable for non-integer steps (e.g.
				// `0.3 % 0.1 !== 0` due to floating-point representation).
				const quotient = value / schema.multipleOf;
				if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
					issues.push(`${path}: not a multiple of ${schema.multipleOf}`);
				}
			}
			return issues;
		}
		case "string": {
			if (typeof value !== "string") {
				return [`${path}: expected string`];
			}
			const issues: string[] = [];
			if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
				issues.push(`${path}: not one of ${schema.enum.join(", ")}`);
			}
			if (
				typeof schema.minLength === "number" &&
				value.length < schema.minLength
			) {
				issues.push(`${path}: shorter than minLength ${schema.minLength}`);
			}
			if (
				typeof schema.maxLength === "number" &&
				value.length > schema.maxLength
			) {
				issues.push(`${path}: longer than maxLength ${schema.maxLength}`);
			}
			if (
				typeof schema.pattern === "string" &&
				!new RegExp(schema.pattern).test(value)
			) {
				issues.push(`${path}: does not match pattern ${schema.pattern}`);
			}
			return issues;
		}
		case "boolean":
			return typeof value === "boolean" ? [] : [`${path}: expected boolean`];
		case "object": {
			if (!isPlainObject(value)) {
				return [`${path}: expected object`];
			}
			const issues: string[] = [];
			const properties = isPlainObject(schema.properties)
				? schema.properties
				: {};
			if (Array.isArray(schema.required)) {
				for (const key of schema.required) {
					if (typeof key === "string" && !(key in value)) {
						issues.push(`${path}.${key}: required`);
					}
				}
			}
			for (const [key, propSchema] of Object.entries(properties)) {
				if (key in value && isPlainObject(propSchema)) {
					issues.push(
						...validateToolInputValue(
							propSchema as IgniteSchemaObject,
							value[key],
							`${path}.${key}`,
						),
					);
				}
			}
			return issues;
		}
		case "array": {
			if (!Array.isArray(value)) {
				return [`${path}: expected array`];
			}
			const issues: string[] = [];
			if (
				typeof schema.minItems === "number" &&
				value.length < schema.minItems
			) {
				issues.push(`${path}: fewer than minItems ${schema.minItems}`);
			}
			if (
				typeof schema.maxItems === "number" &&
				value.length > schema.maxItems
			) {
				issues.push(`${path}: more than maxItems ${schema.maxItems}`);
			}
			if (isPlainObject(schema.items)) {
				const itemSchema = schema.items as IgniteSchemaObject;
				value.forEach((item, index) => {
					issues.push(
						...validateToolInputValue(itemSchema, item, `${path}[${index}]`),
					);
				});
			}
			return issues;
		}
		default:
			// Unknown/unconstrained schema — do not block.
			return [];
	}
}
