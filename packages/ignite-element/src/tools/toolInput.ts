import type { ToolInputSchema } from "./types";

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
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

export function isNoArgSchema(schema: ToolInputSchema): boolean {
	if (schema.type !== "object") {
		return false;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	return (
		Object.keys(properties).length === 0 &&
		(!Array.isArray(schema.required) || schema.required.length === 0)
	);
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
