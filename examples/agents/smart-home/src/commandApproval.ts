/**
 * Application-owned single-use approvals. Ignite does not store or consume
 * these records. `canExecute` receives the validated input and the target
 * runtime, and this module decides.
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

/** Hash of the command name and the validated input. Not an approval store. */
export function approvalHash(name: string, input: unknown): string {
	const payload = `${stable(name)}\u0000${stable(input)}`;
	let hash = 5381;
	for (let index = 0; index < payload.length; index += 1) {
		hash = (hash * 33) ^ payload.charCodeAt(index);
	}
	return (hash >>> 0).toString(16);
}

export function createCommandApprovalAuthority(actor: string) {
	const pending = new Map<
		object,
		Map<string, { name: string; expiresAt: number }>
	>();
	const used = new Map<object, Set<string>>();

	return {
		grant(approval: AppCommandApproval): void {
			if (approval.actor !== actor || approval.expiresAt <= Date.now()) return;
			const hash = approvalHash(approval.name, approval.input);
			const bucket =
				pending.get(approval.target) ??
				new Map<string, { name: string; expiresAt: number }>();
			bucket.set(hash, { name: approval.name, expiresAt: approval.expiresAt });
			pending.set(approval.target, bucket);
		},
		canExecute(
			name: string,
			input?: unknown,
			context?: { core: object },
		): boolean {
			if (!context) {
				for (const bucket of pending.values()) {
					for (const record of bucket.values()) {
						if (record.name === name && record.expiresAt > Date.now()) {
							return true;
						}
					}
				}
				return false;
			}
			const hash = approvalHash(name, input);
			const bucket = pending.get(context.core);
			const record = bucket?.get(hash);
			if (!record || record.expiresAt <= Date.now()) return false;
			const spent = used.get(context.core) ?? new Set<string>();
			if (spent.has(hash)) return false;
			spent.add(hash);
			used.set(context.core, spent);
			bucket?.delete(hash);
			return true;
		},
	};
}
