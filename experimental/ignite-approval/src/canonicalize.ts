// RFC 8785 for the JSON subset this spike uses: objects, arrays, strings,
// finite numbers, booleans, and null. Object keys are sorted by UTF-16 code
// units. Arrays keep their order. Numbers go through JSON.stringify, which is
// not a full ES6 JCS number formatter. See SPIKE-NOTES.md.

export type Json =
	| null
	| boolean
	| number
	| string
	| Json[]
	| { readonly [key: string]: Json };

export function canonicalizeJson(value: Json): string {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string"
	) {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("JCS: NaN and Infinity are not JSON");
		}
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
	}
	const keys = Object.keys(value).sort();
	return `{${keys
		.map(
			(key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key] as Json)}`,
		)
		.join(",")}}`;
}

export type ListMarker = "set" | "sequence";

export type MarkedList<T> = {
	readonly $list: ListMarker;
	readonly items: readonly T[];
};

/** Order is not part of the value. Canonical form sorts and drops duplicates. */
export function setList<T>(items: readonly T[]): MarkedList<T> {
	return { $list: "set", items };
}

/** Order is part of the value. Canonical form keeps it, duplicates included. */
export function sequenceList<T>(items: readonly T[]): MarkedList<T> {
	return { $list: "sequence", items };
}

type PendingMove = {
	readonly move: string;
	readonly projectIds: MarkedList<string>;
	readonly lines: MarkedList<string>;
};

/** A batch whose project ids are a set and whose ledger lines are a sequence. */
export type PendingAction = {
	readonly moves: MarkedList<PendingMove>;
};

const UNMARKED =
	"[igniteApproval] Unmarked arrays are rejected. Mark each list as set or sequence.";

function isPlainObject(value: object): boolean {
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function isMarkedList(value: object): value is {
	$list: ListMarker;
	items: readonly unknown[];
} {
	if (!isPlainObject(value)) return false;
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record);
	if (keys.length !== 2 || !("$list" in record) || !("items" in record)) {
		return false;
	}
	return (
		(record.$list === "set" || record.$list === "sequence") &&
		Array.isArray(record.items)
	);
}

function normalize(value: unknown): Json {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string"
	) {
		return value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("JCS: NaN and Infinity are not JSON");
		}
		return value;
	}
	if (Array.isArray(value)) {
		throw new Error(UNMARKED);
	}
	if (typeof value !== "object") {
		throw new Error(`[igniteApproval] ${typeof value} is not JSON`);
	}
	if (!isPlainObject(value)) {
		throw new Error("[igniteApproval] Only plain objects can be canonicalized");
	}
	if (isMarkedList(value)) {
		return normalizeList(value.$list, value.items);
	}
	const output: { [key: string]: Json } = {};
	for (const key of Object.keys(value)) {
		output[key] = normalize((value as Record<string, unknown>)[key]);
	}
	return output;
}

function normalizeList(marker: ListMarker, items: readonly unknown[]): Json {
	if (marker === "sequence") {
		return {
			$list: "sequence",
			items: items.map((item) => normalize(item)),
		};
	}
	const seen = new Set<string>();
	const entries: { canonical: string; value: Json }[] = [];
	for (const item of items) {
		const normalized = normalize(item);
		const canonical = canonicalizeJson(normalized);
		if (seen.has(canonical)) continue;
		seen.add(canonical);
		entries.push({ canonical, value: normalized });
	}
	entries.sort((left, right) =>
		compareCanonical(left.canonical, right.canonical),
	);
	return {
		$list: "set",
		items: entries.map((entry) => entry.value),
	};
}

function compareCanonical(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

/** Canonical bytes of a pending action. Set lists are sorted and deduped first. */
export function canonicalizeAction(action: PendingAction): string {
	return canonicalizeJson(normalize(action));
}
