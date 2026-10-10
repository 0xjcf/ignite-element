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
	try {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return false;
		}
		// Brand rejects Date, Map, and Set from this realm or another. A plain
		// object from another realm has that realm's Object.prototype, so the
		// prototype check cannot require this realm's Object.prototype.
		if (Object.prototype.toString.call(value) !== "[object Object]") {
			return false;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype === null) return true;
		if (Object.getPrototypeOf(prototype) !== null) return false;
		const ctor = (prototype as { constructor?: unknown }).constructor;
		return (
			typeof ctor === "function" &&
			(ctor as { prototype?: unknown }).prototype === prototype
		);
	} catch {
		return false;
	}
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

/** Nesting limit for one plain-JSON tool input. Deeper values are InvalidInput. */
const MAX_TOOL_INPUT_DEPTH = 32;

type JsonSnapshot =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly issues: string[] };

function snapshotIssue(path: string, detail: string): JsonSnapshot {
	return { ok: false, issues: [`${path}: ${detail}`] };
}

function isNodeProxy(value: object): boolean {
	try {
		const builtin = (
			globalThis as {
				process?: {
					getBuiltinModule?: (name: string) => {
						types?: { isProxy?: (candidate: object) => boolean };
					};
				};
			}
		).process?.getBuiltinModule?.("node:util");
		return builtin?.types?.isProxy?.(value) === true;
	} catch {
		return false;
	}
}

function isPlainArray(value: object): boolean {
	if (!Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype === null) return false;
	const parent = Object.getPrototypeOf(prototype);
	if (parent === null || Object.getPrototypeOf(parent) !== null) return false;
	const ctor = (prototype as { constructor?: unknown }).constructor;
	return (
		typeof ctor === "function" &&
		(ctor as { prototype?: unknown }).prototype === prototype
	);
}

function applySchemaDefaults(
	schema: ToolInputSchema,
	input: unknown,
): JsonSnapshot {
	try {
		if (isNoArgSchema(schema)) return { ok: true, value: input };
		if (input === undefined && "default" in schema) {
			return { ok: true, value: schema.default };
		}
		return { ok: true, value: input };
	} catch {
		return snapshotIssue("input", "unable to read value");
	}
}

function snapshotJsonValue(
	value: unknown,
	path: string,
	depth: number,
	active: WeakSet<object>,
): JsonSnapshot {
	try {
		if (value === null) return { ok: true, value: null };
		if (typeof value === "string" || typeof value === "boolean") {
			return { ok: true, value };
		}
		if (typeof value === "number") {
			if (!Number.isFinite(value)) {
				return snapshotIssue(path, "expected finite number");
			}
			return { ok: true, value: value === 0 ? 0 : value };
		}
		if (typeof value !== "object") {
			return snapshotIssue(path, "expected a JSON value");
		}
		if (isNodeProxy(value)) {
			return snapshotIssue(path, "expected a JSON value");
		}
		if (depth > MAX_TOOL_INPUT_DEPTH) {
			return snapshotIssue(path, "exceeds the maximum nesting depth");
		}
		if (active.has(value)) {
			return snapshotIssue(path, "cyclic data is not allowed");
		}
		if (Array.isArray(value)) {
			return snapshotJsonArray(value, path, depth, active);
		}
		if (isPlainObject(value)) {
			return snapshotJsonObject(value, path, depth, active);
		}
		return snapshotIssue(path, "expected a JSON value");
	} catch {
		return snapshotIssue(path, "unable to read value");
	}
}

function snapshotJsonArray(
	value: unknown[],
	path: string,
	depth: number,
	active: WeakSet<object>,
): JsonSnapshot {
	if (!isPlainArray(value)) {
		return snapshotIssue(path, "expected array");
	}
	active.add(value);
	try {
		const output: unknown[] = [];
		const length = value.length;
		if (!Number.isSafeInteger(length) || length < 0) {
			return snapshotIssue(path, "expected array");
		}
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key === "symbol") {
				return snapshotIssue(path, "symbol properties are not allowed");
			}
			if (key === "length") continue;
			if (!/^(?:0|[1-9]\d*)$/.test(key)) {
				return snapshotIssue(`${path}.${key}`, "unexpected property");
			}
		}
		for (let index = 0; index < length; index += 1) {
			const itemPath = `${path}[${index}]`;
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor) {
				return snapshotIssue(itemPath, "sparse array entries are not allowed");
			}
			if (!("value" in descriptor) || descriptor.enumerable !== true) {
				return snapshotIssue(itemPath, "accessor properties are not allowed");
			}
			const item = snapshotJsonValue(
				descriptor.value,
				itemPath,
				depth + 1,
				active,
			);
			if (!item.ok) return item;
			output.push(item.value);
		}
		return { ok: true, value: Object.freeze(output) };
	} catch {
		return snapshotIssue(path, "unable to read value");
	} finally {
		active.delete(value);
	}
}

function snapshotJsonObject(
	value: Record<string, unknown>,
	path: string,
	depth: number,
	active: WeakSet<object>,
): JsonSnapshot {
	active.add(value);
	try {
		const output: Record<string, unknown> = {};
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key === "symbol") {
				return snapshotIssue(path, "symbol properties are not allowed");
			}
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor || descriptor.enumerable !== true) continue;
			if (!("value" in descriptor)) {
				return snapshotIssue(
					`${path}.${key}`,
					"accessor properties are not allowed",
				);
			}
			const property = snapshotJsonValue(
				descriptor.value,
				`${path}.${key}`,
				depth + 1,
				active,
			);
			if (!property.ok) return property;
			Object.defineProperty(output, key, {
				value: property.value,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
		return { ok: true, value: Object.freeze(output) };
	} catch {
		return snapshotIssue(path, "unable to read value");
	} finally {
		active.delete(value);
	}
}

function snapshotPlainJson(value: unknown, path: string): JsonSnapshot {
	return snapshotJsonValue(value, path, 0, new WeakSet());
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
	try {
		const result = call
			? canExecute(name, call.input, call.context)
			: canExecute(name);
		if (isThenable(result)) {
			void Promise.resolve(result).catch(() => undefined);
			return false;
		}
		return result === true;
	} catch {
		return false;
	}
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
 * Pure: apply a schema default, validate that value, then build one detached
 * plain-JSON snapshot. `canExecute(name, input, context)` and the returned
 * route share that frozen snapshot. Only finite numbers (with `-0` normalized
 * to `0`), strings, booleans, null, arrays, and plain objects are copied.
 * Accessors, proxies, bigint, symbols, functions, `Date` / `Map` / `Set`,
 * cycles, and values past the nesting limit are `InvalidInput`. This function
 * forwards `context` and does not set `execute`. `run` calls it without
 * `execute`, then calls `canExecute` with `{ execute: true }` only after
 * observation is subscribed and immediately before `core.execute`. A throw
 * while reading the input is `InvalidInput`, never an exception. `UnknownCommand`
 * means the name is not in the manifest. `Unavailable` means the predicate is
 * missing, throws, returns a thenable, or returns anything other than true.
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

	let route: Route;
	try {
		const source = applySchemaDefaults(tool.inputSchema, input);
		if (!source.ok) {
			return err({ kind: "InvalidInput", name, issues: source.issues });
		}
		const issues = validateToolInputValue(
			tool.inputSchema,
			source.value,
			"input",
		);
		if (issues.length > 0) {
			return err({ kind: "InvalidInput", name, issues });
		}
		if (isNoArgSchema(tool.inputSchema)) {
			route = { command: name };
		} else if (source.value === undefined) {
			// An omitted optional object stays omitted. It is not a no-arg command,
			// which drops the input field, and it is not a JSON value to snapshot.
			route = { command: name, input: undefined };
		} else {
			const snapshot = snapshotPlainJson(source.value, "input");
			if (!snapshot.ok) {
				return err({ kind: "InvalidInput", name, issues: snapshot.issues });
			}
			route = { command: name, input: snapshot.value };
		}
	} catch {
		return err({
			kind: "InvalidInput",
			name,
			issues: ["input: unable to read value"],
		});
	}
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
		// A substituted default has to satisfy the same schema as a caller value.
		// An undefined default is not a value, so it falls through to the missing
		// input checks below.
		if ("default" in schema) {
			let fallback: unknown;
			try {
				fallback = schema.default;
			} catch {
				return [`${path}: unable to read value`];
			}
			if (fallback !== undefined) {
				return validateToolInputValue(schema, fallback, path);
			}
		}
		if (type === "object") {
			return validateToolInputValue(schema, {}, path);
		}
		return [`${path}: expected ${String(type)} but received undefined`];
	}

	switch (type) {
		case "number": {
			if (typeof value !== "number" || !Number.isFinite(value)) {
				return [`${path}: expected finite number`];
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
			if (
				(typeof value === "object" && value !== null && isNodeProxy(value)) ||
				!isPlainObject(value)
			) {
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
					if (typeof key !== "string") continue;
					const descriptor = Object.getOwnPropertyDescriptor(value, key);
					if (
						!descriptor ||
						descriptor.enumerable !== true ||
						!("value" in descriptor)
					) {
						issues.push(
							descriptor && !("value" in descriptor)
								? `${path}.${key}: accessor properties are not allowed`
								: `${path}.${key}: required`,
						);
					}
				}
			}
			for (const [key, propSchema] of Object.entries(properties)) {
				if (!isPlainObject(propSchema)) continue;
				const descriptor = Object.getOwnPropertyDescriptor(value, key);
				if (!descriptor || descriptor.enumerable !== true) continue;
				if (!("value" in descriptor)) {
					issues.push(`${path}.${key}: accessor properties are not allowed`);
					continue;
				}
				issues.push(
					...validateToolInputValue(
						propSchema,
						descriptor.value,
						`${path}.${key}`,
					),
				);
			}
			return issues;
		}
		case "array": {
			if (
				typeof value !== "object" ||
				value === null ||
				isNodeProxy(value) ||
				!Array.isArray(value)
			) {
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
			const itemSchema = isPlainObject(schema.items) ? schema.items : undefined;
			for (let index = 0; index < value.length; index += 1) {
				const itemPath = `${path}[${index}]`;
				const descriptor = Object.getOwnPropertyDescriptor(
					value,
					String(index),
				);
				if (!descriptor || !("value" in descriptor)) {
					issues.push(
						descriptor
							? `${itemPath}: accessor properties are not allowed`
							: `${itemPath}: expected a JSON value`,
					);
					continue;
				}
				if (descriptor.value === undefined) {
					issues.push(`${itemPath}: expected a JSON value`);
					continue;
				}
				if (itemSchema) {
					issues.push(
						...validateToolInputValue(itemSchema, descriptor.value, itemPath),
					);
				}
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
