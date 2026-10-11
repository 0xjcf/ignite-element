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

function plainShape(value: object): boolean {
	try {
		const brand = Object.prototype.toString.call(value);
		const prototype = Object.getPrototypeOf(value);
		if (brand === "[object Array]") {
			if (prototype === null) return false;
			const parent = Object.getPrototypeOf(prototype);
			if (parent === null || Object.getPrototypeOf(parent) !== null) {
				return false;
			}
			const ctor = (prototype as { constructor?: unknown }).constructor;
			return (
				typeof ctor === "function" &&
				(ctor as { prototype?: unknown }).prototype === prototype
			);
		}
		if (brand !== "[object Object]") return false;
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

function stable(value: unknown, depth = 0, seen?: WeakSet<object>): string {
	try {
		if (depth > MAX_CANONICAL_DEPTH) return "invalid:depth";
		if (typeof value === "number") {
			if (!Number.isFinite(value)) return `invalid:number:${String(value)}`;
			return `number:${value === 0 ? 0 : value}`;
		}
		if (typeof value === "string") return `string:${JSON.stringify(value)}`;
		if (typeof value === "boolean") return `boolean:${value}`;
		if (value === null) return "null";
		if (typeof value === "bigint") return `bigint:${value.toString()}`;
		if (typeof value === "symbol") return `symbol:${String(value)}`;
		if (typeof value !== "object") return `invalid:${typeof value}`;
		const brand = Object.prototype.toString.call(value);
		if (!plainShape(value)) return `invalid:${brand}`;
		const active = seen ?? new WeakSet<object>();
		if (active.has(value)) return "invalid:cycle";
		active.add(value);
		try {
			if (Array.isArray(value)) {
				return stableArray(value, depth, active);
			}
			const record = value as Record<string, unknown>;
			const props: Array<[string, unknown]> = [];
			for (const key of Reflect.ownKeys(record)) {
				if (typeof key === "symbol") return "invalid:symbol";
				const descriptor = Object.getOwnPropertyDescriptor(record, key);
				if (!descriptor || descriptor.enumerable !== true) continue;
				if (!("value" in descriptor)) return "invalid:accessor";
				props.push([key, descriptor.value]);
			}
			props.sort((left, right) => (left[0] < right[0] ? -1 : 1));
			const body = props
				.map(
					([key, property]) =>
						`${JSON.stringify(key)}:${stable(property, depth + 1, active)}`,
				)
				.join(",");
			return `object:{${body}}`;
		} finally {
			active.delete(value);
		}
	} catch {
		return "invalid:unreadable";
	}
}

function stableArray(
	value: unknown[],
	depth: number,
	active: WeakSet<object>,
): string {
	const indexed = new Map<number, unknown>();
	let length: number | undefined;
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === "symbol") return "invalid:symbol";
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor)) return "invalid:array";
		if (key === "length") {
			const reported = descriptor.value;
			if (
				typeof reported !== "number" ||
				!Number.isSafeInteger(reported) ||
				reported < 0
			) {
				return "invalid:array";
			}
			length = reported;
			continue;
		}
		if (!/^(?:0|[1-9]\d*)$/.test(key)) return "invalid:array";
		indexed.set(Number(key), descriptor.value);
	}
	if (length === undefined) {
		length = 0;
		for (const index of indexed.keys()) {
			if (index + 1 > length) length = index + 1;
		}
	}
	if (indexed.size !== length) return "invalid:array";
	const items: string[] = [];
	for (let index = 0; index < length; index += 1) {
		items.push(stable(indexed.get(index), depth + 1, active));
	}
	return `array:[${items.join(",")}]`;
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
