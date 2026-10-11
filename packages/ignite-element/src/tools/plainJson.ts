import { isNoArgSchema, isPlainObject } from "./toolInput";
import type { ToolInputSchema } from "./types";

/** Nesting limit for one plain-JSON tool input. Deeper values are InvalidInput. */
const MAX_TOOL_INPUT_DEPTH = 32;

type JsonSnapshot =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly issues: string[] };

function snapshotIssue(path: string, detail: string): JsonSnapshot {
	return { ok: false, issues: [`${path}: ${detail}`] };
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

export function applySchemaDefaults(
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

function propertySchema(
	schema: ToolInputSchema | undefined,
	key: string,
): ToolInputSchema | undefined {
	if (!schema || !isPlainObject(schema.properties)) return undefined;
	const child = schema.properties[key];
	return isPlainObject(child) ? (child as ToolInputSchema) : undefined;
}

function itemSchema(
	schema: ToolInputSchema | undefined,
): ToolInputSchema | undefined {
	if (!schema || !isPlainObject(schema.items)) return undefined;
	return schema.items as ToolInputSchema;
}

function snapshotJsonValue(
	value: unknown,
	path: string,
	depth: number,
	active: WeakSet<object>,
	schema?: ToolInputSchema,
): JsonSnapshot {
	try {
		if (value === undefined && schema && "default" in schema) {
			let fallback: unknown;
			try {
				fallback = schema.default;
			} catch {
				return snapshotIssue(path, "unable to read value");
			}
			if (fallback !== undefined) {
				return snapshotJsonValue(fallback, path, depth, active, schema);
			}
		}
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
		if (depth > MAX_TOOL_INPUT_DEPTH) {
			return snapshotIssue(path, "exceeds the maximum nesting depth");
		}
		if (active.has(value)) {
			return snapshotIssue(path, "cyclic data is not allowed");
		}
		if (Array.isArray(value)) {
			return snapshotJsonArray(value, path, depth, active, schema);
		}
		if (isPlainObject(value)) {
			return snapshotJsonObject(value, path, depth, active, schema);
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
	schema?: ToolInputSchema,
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
				itemSchema(schema),
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
	schema?: ToolInputSchema,
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
				propertySchema(schema, key),
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

export function snapshotPlainJson(
	value: unknown,
	path: string,
	schema?: ToolInputSchema,
): JsonSnapshot {
	return snapshotJsonValue(value, path, 0, new WeakSet(), schema);
}
