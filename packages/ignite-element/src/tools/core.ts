import { err, ok, type Result } from "./result";
import type {
	AvailabilityPredicate,
	NeutralManifest,
	NeutralTool,
	Route,
	ToolCommandSchema,
	ToolError,
	ToolInputSchema,
	ToolSchema,
} from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TOOL_INPUT_TYPES = new Set([
	"number",
	"string",
	"boolean",
	"object",
	"array",
]);

function unsupportedInputTypeError(type: unknown, path: string): Error {
	return new Error(
		`[igniteTools] Unsupported input schema type ${JSON.stringify(type)} at ${path}. Supported types: number, string, boolean, object, array.`,
	);
}

function assertSupportedInputSchema(
	schema: ToolInputSchema,
	path: string,
): void {
	if (!isPlainObject(schema)) {
		throw new Error(
			`[igniteTools] Missing explicit command input schema at ${path}. Supply tool/application definitions; discovery does not infer schemas.`,
		);
	}
	if ("type" in schema && schema.type !== undefined) {
		if (!TOOL_INPUT_TYPES.has(schema.type)) {
			throw unsupportedInputTypeError(schema.type, path);
		}
	}
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	for (const [key, property] of Object.entries(properties)) {
		if (isPlainObject(property)) {
			assertSupportedInputSchema(property, `${path}.properties.${key}`);
		}
	}
	if (isPlainObject(schema.items)) {
		assertSupportedInputSchema(schema.items, `${path}.items`);
	}
}

/** Reject unknown `type` strings before a schema is offered as tools. */
export function assertSupportedToolSchema(schema: ToolSchema): void {
	if (!isPlainObject(schema)) {
		throw new Error(
			"[igniteTools] Unknown command catalogue. Supply explicit tool definitions.",
		);
	}
	for (const name of Object.keys(schema)) {
		const metadata = schema[name];
		if (!isPlainObject(metadata)) {
			throw new Error(
				`[igniteTools] Missing explicit command input schema at ${name}. Supply tool/application definitions; discovery does not infer schemas.`,
			);
		}
		assertSupportedInputSchema(metadata.input, `${name}.input`);
	}
}

function isNoArgSchema(schema: ToolInputSchema): boolean {
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
	schema: ToolInputSchema,
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

// Explicit application input schema, scalar or object, mirrored verbatim.
// Unknown discovery metadata must not fabricate an empty-object contract.
function toInputSchema(metadata: ToolCommandSchema): ToolInputSchema {
	if (!isPlainObject(metadata)) {
		throw new Error(
			"[igniteTools] Missing explicit command input schema. Supply tool/application definitions; discovery does not infer schemas.",
		);
	}
	const input = metadata.input;
	if (!isPlainObject(input)) {
		throw new Error(
			"[igniteTools] Missing explicit command input schema. Supply tool/application definitions; discovery does not infer schemas.",
		);
	}
	assertSupportedInputSchema(input, "input");
	return input;
}

/**
 * Advanced/testing helper. Everyday apps should bind with
 * `igniteTools({ core, schema, canExecute?, dialect? })` instead of importing
 * this.
 *
 * Pure: explicit application schema → neutral tool manifest, sorted by name.
 * Gated commands are omitted when an availability predicate reports them
 * currently unavailable. Without a predicate, commands are denied. An ungated
 * `read: true` tool stays available only when that command is side-effect-free.
 *
 * Only the bare command map is read. Minimal core discovery does not provide
 * input validation; missing explicit definitions fail before execution.
 */
function isSideEffectFreeRead(tool: {
	read?: boolean;
	gated?: boolean;
	consequential?: boolean;
}): boolean {
	return (
		tool.read === true && tool.consequential !== true && tool.gated !== true
	);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as PromiseLike<unknown>).then === "function"
	);
}

function predicateAllows(
	canExecute: AvailabilityPredicate | undefined,
	name: string,
	call?: {
		input: unknown;
		context?: { readonly core: object; readonly execute?: boolean };
	},
): boolean {
	if (typeof canExecute !== "function") return false;
	let result: unknown;
	try {
		result = call
			? canExecute(name, call.input, call.context)
			: canExecute(name);
	} catch {
		return false;
	}
	if (isThenable(result)) {
		void Promise.resolve(result).catch(() => undefined);
		return false;
	}
	return result === true;
}

function allowsTool(
	tool: { read?: boolean; gated?: boolean; consequential?: boolean },
	name: string,
	canExecute?: AvailabilityPredicate,
	call?: {
		input: unknown;
		context?: { readonly core: object; readonly execute?: boolean };
	},
): boolean {
	if (isSideEffectFreeRead(tool)) return true;
	return predicateAllows(canExecute, name, call);
}

export function buildManifest(
	schema: ToolSchema,
	canExecute?: AvailabilityPredicate,
): NeutralManifest {
	if (!isPlainObject(schema)) {
		throw new Error(
			"[igniteTools] Unknown command catalogue. Supply explicit tool definitions.",
		);
	}
	assertSupportedToolSchema(schema);
	const manifest: NeutralManifest = [];

	for (const name of Object.keys(schema).sort()) {
		const metadata = schema[name];
		const consequential = metadata.consequential === true;
		const read = metadata.read === true && !consequential;
		const gated = metadata.gated === true;
		if (!allowsTool({ read, gated, consequential }, name, canExecute)) {
			continue;
		}

		const tool: NeutralTool = {
			name,
			inputSchema: toInputSchema(metadata),
			gated,
			read,
			consequential,
		};
		if (typeof metadata.description === "string") {
			tool.description = metadata.description;
		}
		manifest.push(tool);
	}

	return manifest;
}

/**
 * Advanced/testing helper. Everyday apps should call `run` on a named
 * `igniteTools({ core, schema })` bind instead of importing this.
 *
 * Pure: validate a model-supplied input against a command's schema and route it
 * to `{ command, input? }`. A call then asks `canExecute(name, input, context)`
 * with that validated input. This function forwards `context` and does not set
 * `execute`. The `run` shell passes `{ execute: true }` only immediately before
 * `core.execute`. Errors are returned as values — `UnknownCommand`
 * (not in the manifest), `InvalidInput` (fails the input schema), or
 * `Unavailable` (the predicate is missing, throws, returns a thenable, or
 * returns anything other than true). Never throws.
 */
export function resolveCall(
	manifest: NeutralManifest,
	name: string,
	input: unknown,
	canExecute?: AvailabilityPredicate,
	context?: { readonly core: object; readonly execute?: boolean },
): Result<Route, ToolError> {
	const tool = manifest.find((candidate) => candidate.name === name);
	if (!tool) {
		return err({ kind: "UnknownCommand", name });
	}

	const issues = validateToolInputValue(tool.inputSchema, input, "input");
	if (issues.length > 0) {
		return err({ kind: "InvalidInput", name, issues });
	}

	const route = {
		command: name,
		...normalizeRouteInput(tool.inputSchema, input),
	};
	if (
		!allowsTool(tool, name, canExecute, {
			input: route.input,
			context,
		})
	) {
		return err({ kind: "Unavailable", name });
	}

	return ok(route);
}

/**
 * Minimal structural validation covering the command-input metadata vocabulary
 * (number/string/boolean/enum/object/array + their declared constraints). Pure;
 * returns the list of issues (empty = valid). Not a full JSON-Schema validator —
 * scoped to the retained application input vocabulary.
 */
export function validateToolInputValue(
	schema: ToolInputSchema,
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
			if (isNoArgSchema(schema)) {
				for (const key of Object.keys(value)) {
					issues.push(`${path}.${key}: unexpected`);
				}
				return issues;
			}
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
						...validateToolInputValue(propSchema, value[key], `${path}.${key}`),
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
				const itemSchema = schema.items;
				value.forEach((item, index) => {
					issues.push(
						...validateToolInputValue(itemSchema, item, `${path}[${index}]`),
					);
				});
			}
			return issues;
		}
		default:
			if (type !== undefined) {
				return [`${path}: unsupported type ${String(type)}`];
			}
			return [];
	}
}
