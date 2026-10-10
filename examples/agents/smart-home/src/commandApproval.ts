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

function stable(value: unknown): string {
	if (typeof value === "number") {
		if (Object.is(value, -0)) return "number:-0";
		if (value === Number.POSITIVE_INFINITY) return "number:Infinity";
		if (value === Number.NEGATIVE_INFINITY) return "number:-Infinity";
		if (Number.isNaN(value)) return "number:NaN";
		return `number:${value}`;
	}
	if (typeof value === "string") return `string:${JSON.stringify(value)}`;
	if (typeof value === "boolean") return `boolean:${value}`;
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) {
		return `array:[${value.map((item) => stable(item)).join(",")}]`;
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const body = Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
			.join(",");
		return `object:{${body}}`;
	}
	return `other:${typeof value}`;
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

	function prune(): void {
		const time = now();
		for (const [id, expiresAt] of spent) {
			if (expiresAt <= time) spent.delete(id);
		}
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
			spent.set(match.id, match.expiresAt);
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
