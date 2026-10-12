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
		// One pass over own data descriptors. Brand and prototype checks run
		// on the frozen copy this returns, not on the caller object.
		if (Array.isArray(value)) {
			return snapshotJsonArray(value, path, depth, active, schema);
		}
		return snapshotJsonObject(
			value as Record<string, unknown>,
			path,
			depth,
			active,
			schema,
		);
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
	active.add(value);
	try {
		const indexed = new Map<number, unknown>();
		let length: number | undefined;
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key === "symbol") {
				return snapshotIssue(path, "symbol properties are not allowed");
			}
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor) {
				return snapshotIssue(path, "unable to read value");
			}
			if (key === "length") {
				const reported = descriptor.value;
				if (
					!("value" in descriptor) ||
					typeof reported !== "number" ||
					!Number.isSafeInteger(reported) ||
					reported < 0
				) {
					return snapshotIssue(path, "expected array");
				}
				length = reported;
				continue;
			}
			if (!/^(?:0|[1-9]\d*)$/.test(key)) {
				return snapshotIssue(`${path}.${key}`, "unexpected property");
			}
			const itemPath = `${path}[${key}]`;
			if (!("value" in descriptor) || descriptor.enumerable !== true) {
				return snapshotIssue(itemPath, "accessor properties are not allowed");
			}
			indexed.set(Number(key), descriptor.value);
		}
		if (length === undefined) {
			length = 0;
			for (const index of indexed.keys()) {
				if (index + 1 > length) length = index + 1;
			}
		}
		for (const index of indexed.keys()) {
			if (index >= length) {
				return snapshotIssue(`${path}[${index}]`, "unexpected property");
			}
		}
		if (indexed.size !== length) {
			return snapshotIssue(path, "sparse array entries are not allowed");
		}
		const output: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			const item = snapshotJsonValue(
				indexed.get(index),
				`${path}[${index}]`,
				depth + 1,
				active,
				itemSchema(schema),
			);
			if (!item.ok) return item;
			output.push(item.value);
		}
		const sealed = Object.freeze(output);
		if (Object.getPrototypeOf(sealed) !== Array.prototype) {
			return snapshotIssue(path, "expected array");
		}
		return { ok: true, value: sealed };
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
		const sealed = Object.freeze(output);
		if (!isPlainObject(sealed)) {
			return snapshotIssue(path, "expected a JSON value");
		}
		return { ok: true, value: sealed };
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
