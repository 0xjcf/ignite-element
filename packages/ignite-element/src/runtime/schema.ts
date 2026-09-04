import type { IgniteSchemaValue } from "../types/schema";

function normalizeArray(
	value: unknown[],
	seen: WeakSet<object>,
): IgniteSchemaValue[] {
	return value.map((item) => {
		const normalized = toSchemaValue(item, seen);
		return normalized === undefined ? null : normalized;
	});
}

function normalizeObject(
	value: Record<string, unknown>,
	seen: WeakSet<object>,
): IgniteSchemaValue {
	if (seen.has(value)) {
		return "[Circular]";
	}

	seen.add(value);

	const normalizedEntries = Object.entries(value).flatMap(([key, entry]) => {
		const normalized = toSchemaValue(entry, seen);
		return typeof normalized === "undefined"
			? []
			: [[key, normalized] as const];
	});

	return Object.fromEntries(normalizedEntries);
}

export function toSchemaValue(
	value: unknown,
	seen: WeakSet<object> = new WeakSet(),
): IgniteSchemaValue | undefined {
	if (value === null) {
		return null;
	}

	switch (typeof value) {
		case "boolean":
		case "number":
		case "string":
			return value;
		case "bigint":
			return value.toString();
		case "undefined":
		case "function":
		case "symbol":
			return undefined;
		case "object": {
			if (value instanceof Date) {
				return value.toISOString();
			}

			if (Array.isArray(value)) {
				return normalizeArray(value, seen);
			}

			const jsonSerializable = value as { toJSON?: () => unknown };
			if (typeof jsonSerializable.toJSON === "function") {
				return toSchemaValue(jsonSerializable.toJSON(), seen);
			}

			return normalizeObject(value as Record<string, unknown>, seen);
		}
		default:
			return String(value);
	}
}
