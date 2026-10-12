/**
 * Application-owned single-use approvals. Ignite does not store or consume
 * these records. `canExecute` receives the validated input and the target
 * runtime. This module compares the canonical call and consumes an approval
 * id only when `context.execute` is set, which is the run path immediately
 * before execute.
 */
export type AppCommandApproval = {
	actor: string;
	name: string;
	input: unknown;
	target: object;
	id: string;
	expiresAt: number;
};

const MAX_CANONICAL_DEPTH = 32;

/** Longest approval window. Spent ids are forgotten only after this passes. */
export const MAX_GRANT_LIFETIME_MS = 24 * 60 * 60 * 1000;

function constructorMatches(prototype: object): boolean {
	const ctor = Object.getOwnPropertyDescriptor(prototype, "constructor");
	if (!ctor || !("value" in ctor)) return false;
	const value = ctor.value;
	return (
		typeof value === "function" &&
		(value as { prototype?: unknown }).prototype === prototype
	);
}

function plainShape(value: object): boolean {
	try {
		const prototype = Object.getPrototypeOf(value);
		if (Array.isArray(value)) {
			if (prototype === null) return false;
			const parent = Object.getPrototypeOf(prototype);
			if (parent === null || Object.getPrototypeOf(parent) !== null) {
				return false;
			}
			return constructorMatches(prototype);
		}
		if (prototype === null) return true;
		if (Object.getPrototypeOf(prototype) !== null) return false;
		return constructorMatches(prototype);
	} catch {
		return false;
	}
}

type Sealed =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly reason: string };

function seal(value: unknown, depth: number, active: WeakSet<object>): Sealed {
	try {
		// A JSON leaf is sealed before the depth limit, matching the snapshot.
		if (typeof value === "number") {
			if (!Number.isFinite(value)) {
				return { ok: false, reason: `invalid:number:${String(value)}` };
			}
			return { ok: true, value: value === 0 ? 0 : value };
		}
		if (typeof value === "string" || typeof value === "boolean") {
			return { ok: true, value };
		}
		if (value === null) return { ok: true, value: null };
		if (depth > MAX_CANONICAL_DEPTH) {
			return { ok: false, reason: "invalid:depth" };
		}
		if (typeof value === "bigint" || typeof value === "symbol") {
			return { ok: true, value };
		}
		if (typeof value !== "object") {
			return { ok: false, reason: `invalid:${typeof value}` };
		}
		if (active.has(value)) return { ok: false, reason: "invalid:cycle" };
		active.add(value);
		try {
			if (Array.isArray(value)) return sealArray(value, depth, active);
			return sealObject(value as Record<string, unknown>, depth, active);
		} finally {
			active.delete(value);
		}
	} catch {
		return { ok: false, reason: "invalid:unreadable" };
	}
}

function sealArray(
	value: unknown[],
	depth: number,
	active: WeakSet<object>,
): Sealed {
	const indexed = new Map<number, unknown>();
	let length: number | undefined;
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === "symbol") return { ok: false, reason: "invalid:symbol" };
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor)) {
			return { ok: false, reason: "invalid:array" };
		}
		if (key === "length") {
			const reported = descriptor.value;
			if (
				typeof reported !== "number" ||
				!Number.isSafeInteger(reported) ||
				reported < 0
			) {
				return { ok: false, reason: "invalid:array" };
			}
			length = reported;
			continue;
		}
		if (!/^(?:0|[1-9]\d*)$/.test(key)) {
			return { ok: false, reason: "invalid:array" };
		}
		indexed.set(Number(key), descriptor.value);
	}
	if (length === undefined) {
		length = 0;
		for (const index of indexed.keys()) {
			if (index + 1 > length) length = index + 1;
		}
	}
	if (indexed.size !== length) return { ok: false, reason: "invalid:array" };
	const output: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const item = seal(indexed.get(index), depth + 1, active);
		if (!item.ok) return item;
		output.push(item.value);
	}
	return { ok: true, value: Object.freeze(output) };
}

function sealObject(
	value: Record<string, unknown>,
	depth: number,
	active: WeakSet<object>,
): Sealed {
	const output: Record<string, unknown> = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === "symbol") return { ok: false, reason: "invalid:symbol" };
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || descriptor.enumerable !== true) continue;
		if (!("value" in descriptor)) {
			return { ok: false, reason: "invalid:accessor" };
		}
		const property = seal(descriptor.value, depth + 1, active);
		if (!property.ok) return property;
		Object.defineProperty(output, key, {
			value: property.value,
			enumerable: true,
			writable: true,
			configurable: true,
		});
	}
	return { ok: true, value: Object.freeze(output) };
}

function encode(value: unknown, depth: number): string {
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return `invalid:number:${String(value)}`;
		return `number:${value === 0 ? 0 : value}`;
	}
	if (typeof value === "string") return `string:${JSON.stringify(value)}`;
	if (typeof value === "boolean") return `boolean:${value}`;
	if (value === null) return "null";
	if (depth > MAX_CANONICAL_DEPTH) return "invalid:depth";
	if (typeof value === "bigint") return `bigint:${value.toString()}`;
	if (typeof value === "symbol") return `symbol:${String(value)}`;
	if (typeof value !== "object") return `invalid:${typeof value}`;
	if (Array.isArray(value)) {
		const items: string[] = [];
		for (let index = 0; index < value.length; index += 1) {
			items.push(encode(value[index], depth + 1));
		}
		return `array:[${items.join(",")}]`;
	}
	const props: Array<[string, unknown]> = [];
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string") return "invalid:symbol";
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || descriptor.enumerable !== true) continue;
		if (!("value" in descriptor)) return "invalid:accessor";
		props.push([key, descriptor.value]);
	}
	props.sort((left, right) => (left[0] < right[0] ? -1 : 1));
	const body = props
		.map(
			([key, property]) =>
				`${JSON.stringify(key)}:${encode(property, depth + 1)}`,
		)
		.join(",");
	return `object:{${body}}`;
}

function stable(value: unknown, depth = 0): string {
	const sealed = seal(value, depth, new WeakSet());
	if (!sealed.ok) return sealed.reason;
	if (
		sealed.value !== null &&
		typeof sealed.value === "object" &&
		!plainShape(sealed.value)
	) {
		return "invalid:prototype";
	}
	return encode(sealed.value, depth);
}

/** Canonical command name plus validated input. Compared in full, not hashed. */
export function canonicalCall(name: string, input: unknown): string {
	return `${stable(name)}\u0000${stable(input)}`;
}

type PendingApproval = {
	id: string;
	actor: string;
	name: string;
	call: string;
	expiresAt: number;
};

export function createCommandApprovalAuthority(
	actor: string,
	now: () => number = Date.now,
) {
	const pending = new Map<object, PendingApproval[]>();
	const spent = new Map<string, number>();

	function spentId(id: string, time: number): boolean {
		const retainUntil = spent.get(id);
		return retainUntil !== undefined && retainUntil > time;
	}

	function prune(): void {
		const time = now();
		for (const [id, retainUntil] of spent) {
			if (retainUntil <= time) spent.delete(id);
		}
		for (const [target, bucket] of pending) {
			const liveRecords = bucket.filter(
				(record) => record.expiresAt > time && !spentId(record.id, time),
			);
			if (liveRecords.length === 0) pending.delete(target);
			else if (liveRecords.length !== bucket.length) {
				pending.set(target, liveRecords);
			}
		}
	}

	function live(record: PendingApproval): boolean {
		return record.expiresAt > now() && !spentId(record.id, now());
	}

	function withinGrantWindow(expiresAt: number, time: number): boolean {
		return expiresAt > time && expiresAt <= time + MAX_GRANT_LIFETIME_MS;
	}

	return {
		grant(approval: AppCommandApproval): void {
			prune();
			const time = now();
			if (approval.actor !== actor) return;
			if (!withinGrantWindow(approval.expiresAt, time)) return;
			if (spentId(approval.id, time)) return;
			const bucket = (pending.get(approval.target) ?? []).filter(
				(record) => record.id !== approval.id,
			);
			bucket.push({
				id: approval.id,
				actor: approval.actor,
				name: approval.name,
				call: canonicalCall(approval.name, approval.input),
				expiresAt: approval.expiresAt,
			});
			pending.set(approval.target, bucket);
		},
		canExecute(
			name: string,
			input?: unknown,
			context?: { core: object; execute?: boolean },
		): boolean {
			prune();
			if (!context) {
				for (const bucket of pending.values()) {
					if (bucket.some((record) => record.name === name && live(record))) {
						return true;
					}
				}
				return false;
			}
			const call = canonicalCall(name, input);
			const bucket = pending.get(context.core) ?? [];
			const match = bucket.find(
				(record) =>
					record.actor === actor &&
					record.name === name &&
					record.call === call &&
					live(record),
			);
			if (!match) return false;
			if (context.execute !== true) return true;
			spent.set(match.id, match.expiresAt + MAX_GRANT_LIFETIME_MS);
			const rest = bucket.filter((record) => record.id !== match.id);
			if (rest.length === 0) pending.delete(context.core);
			else pending.set(context.core, rest);
			return true;
		},
		ledger(): { targets: number; pending: number; spent: number } {
			prune();
			let pendingCount = 0;
			for (const bucket of pending.values()) pendingCount += bucket.length;
			return {
				targets: pending.size,
				pending: pendingCount,
				spent: spent.size,
			};
		},
	};
}
