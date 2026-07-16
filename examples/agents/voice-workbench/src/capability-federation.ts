import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";

export type CapabilityReceipt = {
	provider: string;
	queryCount?: number;
	sourceCount?: number;
	cache?: {
		status: "miss" | "hit" | "coalesced";
		ttlMs: number;
	};
	fallback?: CapabilityFallbackAttempt;
};

export type CapabilityFallbackAttempt = {
	from: string;
	provider: string;
	status: number;
	outcome: "success" | "failure" | "timeout" | "threw";
};

export type CapabilityRetryFact = {
	attempts: number;
	maxAttempts: number;
	retryAfterMs?: number;
	exhausted: boolean;
};

export type CapabilityExecutionFact =
	| {
			type: "success";
			ownerId: string;
			toolName: string;
			data: unknown;
			receipt: CapabilityReceipt;
	  }
	| {
			type: "unavailable" | "validation" | "timeout" | "provider-failure";
			ownerId: string;
			toolName: string;
			message: string;
			issues?: readonly string[];
			status?: number;
			retry?: CapabilityRetryFact;
			fallback?: CapabilityFallbackAttempt;
			reason?: string;
			actorRejected?: boolean;
	  };

export type CapabilityOwner = {
	id: string;
	manifest: NeutralManifest;
	run(
		call: NeutralToolCall,
		signal?: AbortSignal,
	): Promise<CapabilityExecutionFact>;
};

export type CapabilityFederation = {
	ok: true;
	manifest: NeutralManifest;
	ownerByTool: ReadonlyMap<string, CapabilityOwner>;
};

export type CapabilityFederationResult =
	| CapabilityFederation
	| {
			ok: false;
			error: {
				type: "collision";
				toolNames: string[];
				owners: string[];
			};
	  };

export const createCapabilityFederation = (
	owners: readonly CapabilityOwner[],
): CapabilityFederationResult => {
	const manifest: NeutralManifest = [];
	const ownerByTool = new Map<string, CapabilityOwner>();
	const collisions = new Map<string, string[]>();

	for (const owner of owners) {
		for (const tool of owner.manifest) {
			const existing = ownerByTool.get(tool.name);
			if (existing) {
				collisions.set(tool.name, [
					...(collisions.get(tool.name) ?? [existing.id]),
					owner.id,
				]);
				continue;
			}
			ownerByTool.set(tool.name, owner);
			manifest.push(tool);
		}
	}

	if (collisions.size > 0) {
		return {
			ok: false,
			error: {
				type: "collision",
				toolNames: [...collisions.keys()],
				owners: [...new Set([...collisions.values()].flat())],
			},
		};
	}

	return { ok: true, manifest, ownerByTool };
};

export const runCapability = async (
	federation: CapabilityFederation,
	call: NeutralToolCall,
	signal?: AbortSignal,
): Promise<CapabilityExecutionFact> => {
	const owner = federation.ownerByTool.get(call.name);
	if (!owner) {
		return {
			type: "unavailable",
			ownerId: "federation",
			toolName: call.name,
			message: "The capability is not available in this turn.",
		};
	}
	if (signal?.aborted) {
		return {
			type: "timeout",
			ownerId: owner.id,
			toolName: call.name,
			message: "The capability execution was cancelled.",
		};
	}

	try {
		const fact = signal ? await owner.run(call, signal) : await owner.run(call);
		if (signal?.aborted) {
			return {
				type: "timeout",
				ownerId: owner.id,
				toolName: call.name,
				message: "The capability execution was cancelled.",
			};
		}
		return { ...fact, ownerId: owner.id, toolName: call.name };
	} catch {
		if (signal?.aborted) {
			return {
				type: "timeout",
				ownerId: owner.id,
				toolName: call.name,
				message: "The capability execution was cancelled.",
			};
		}
		return {
			type: "provider-failure",
			ownerId: owner.id,
			toolName: call.name,
			message: "The capability provider failed unexpectedly.",
		};
	}
};
