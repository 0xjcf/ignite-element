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

function plainShape(value: object): boolean {
	try {
		if (isNodeProxy(value)) return false;
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
		if (isNodeProxy(value)) return "invalid:proxy";
		const brand = Object.prototype.toString.call(value);
		if (!plainShape(value)) return `invalid:${brand}`;
		const active = seen ?? new WeakSet<object>();
		if (active.has(value)) return "invalid:cycle";
		active.add(value);
		try {
			if (Array.isArray(value)) {
				const items: string[] = [];
				for (let index = 0; index < value.length; index += 1) {
					const descriptor = Object.getOwnPropertyDescriptor(
						value,
						String(index),
					);
					if (!descriptor || !("value" in descriptor)) return "invalid:array";
					items.push(stable(descriptor.value, depth + 1, active));
				}
				return `array:[${items.join(",")}]`;
			}
			const record = value as Record<string, unknown>;
			const keys: string[] = [];
			for (const key of Reflect.ownKeys(record)) {
				if (typeof key === "symbol") return "invalid:symbol";
				const descriptor = Object.getOwnPropertyDescriptor(record, key);
				if (!descriptor || descriptor.enumerable !== true) continue;
				if (!("value" in descriptor)) return "invalid:accessor";
				keys.push(key);
			}
			keys.sort();
			const body = keys
				.map((key) => {
					const descriptor = Object.getOwnPropertyDescriptor(record, key);
					const property =
						descriptor && "value" in descriptor ? descriptor.value : undefined;
					return `${JSON.stringify(key)}:${stable(property, depth + 1, active)}`;
				})
				.join(",");
			return `object:{${body}}`;
		} finally {
			active.delete(value);
		}
	} catch {
		return "invalid:unreadable";
	}
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
	const spent = new Set<string>();

	function prune(): void {
		const time = now();
		for (const [target, bucket] of pending) {
			const liveRecords = bucket.filter(
				(record) => record.expiresAt > time && !spent.has(record.id),
			);
			if (liveRecords.length === 0) pending.delete(target);
			else if (liveRecords.length !== bucket.length) {
				pending.set(target, liveRecords);
			}
		}
	}

	function live(record: PendingApproval): boolean {
		return record.expiresAt > now() && !spent.has(record.id);
	}

	return {
		grant(approval: AppCommandApproval): void {
			prune();
			if (approval.actor !== actor || approval.expiresAt <= now()) return;
			if (spent.has(approval.id)) return;
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
			spent.add(match.id);
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
