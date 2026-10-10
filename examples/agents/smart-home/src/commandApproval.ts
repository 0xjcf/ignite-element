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
		if (value === Number.POSITIVE_INFINITY) return "Infinity";
		if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
		if (Number.isNaN(value)) return "NaN";
	}
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) {
		return `[${value.map((item) => stable(item)).join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/** Canonical command name plus validated input. Compared in full, not hashed. */
export function canonicalCall(name: string, input: unknown): string {
	return `${stable(name)}\u0000${stable(input)}`;
}

type PendingApproval = {
	id: string;
	name: string;
	call: string;
	expiresAt: number;
};

export function createCommandApprovalAuthority(actor: string) {
	const pending = new Map<object, PendingApproval[]>();
	const spent = new Set<string>();

	function live(record: PendingApproval): boolean {
		return record.expiresAt > Date.now() && !spent.has(record.id);
	}

	return {
		grant(approval: AppCommandApproval): void {
			if (approval.actor !== actor || approval.expiresAt <= Date.now()) return;
			if (spent.has(approval.id)) return;
			const bucket = (pending.get(approval.target) ?? []).filter(
				(record) => record.id !== approval.id,
			);
			bucket.push({
				id: approval.id,
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
					record.name === name && record.call === call && live(record),
			);
			if (!match) return false;
			if (context.execute !== true) return true;
			spent.add(match.id);
			pending.set(
				context.core,
				bucket.filter((record) => record.id !== match.id),
			);
			return true;
		},
	};
}
