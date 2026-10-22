import { createPublicKey, verify } from "node:crypto";
import { bindingDigest, hashBinding } from "./binding";
import type { IssuedChallenge } from "./challenge";
import { confirmViewFromBytes } from "./confirmView";
import type { Actor, SignedApprovalEvent } from "./types";

/**
 * Gatekeeper for this spike. Guards are pure and named. `step` only records
 * them and names effects. `applyEffects` is where spend and audit are
 * committed. Network stays out of both: the challenge was issued earlier,
 * through the challenge port.
 */

export type ApprovalPhase = "open" | "closed";

export type ApprovalState = {
	readonly phase: ApprovalPhase;
	readonly ownerId: string;
	readonly ownerPublicKeyPem: string;
	readonly now: number;
	readonly maxTtlMs: number;
	readonly issued: readonly IssuedChallenge[];
	readonly spent: readonly string[];
	readonly audit: readonly AuditEntry[];
	readonly trace: Trace | null;
	readonly canonicalBytes: string;
	readonly authenticatorLabel: string;
	readonly authenticatorKind: "" | "test-ed25519" | "webauthn";
	readonly provesUserPresence: boolean;
};

export type AuditEntry = {
	readonly seq: number;
	readonly event: "approved" | "refused";
	readonly challengeId: string;
	readonly actor: string;
	readonly move: string;
	readonly code?: string;
};

export type GuardName =
	| "challengeKnown"
	| "hasValidChallenge"
	| "actorIsHuman"
	| "isOwner"
	| "approvalBinds"
	| "signatureHolds";

export type GuardResults = Partial<Record<GuardName, boolean>>;

export type Refusal = {
	readonly guard: GuardName;
	readonly code: string;
};

export type Effect =
	| { readonly type: "spendChallenge"; readonly challengeId: string }
	| {
			readonly type: "audit";
			readonly entry: {
				readonly event: "approved" | "refused";
				readonly challengeId: string;
				readonly actor: string;
				readonly move: string;
				readonly code?: string;
			};
	  };

export type Trace = {
	readonly from: ApprovalPhase;
	readonly event: "SUBMIT_SIGNED";
	readonly actor: Actor;
	readonly guards: GuardResults;
	readonly to?: ApprovalPhase;
	readonly refusal?: Refusal;
	readonly effects: readonly Effect[];
};

export type ApprovalSeed = {
	readonly ownerId: string;
	readonly ownerPublicKeyPem: string;
	readonly now: number;
	readonly maxTtlMs: number;
	readonly issued: readonly IssuedChallenge[];
};

export function initialApprovalState(seed: ApprovalSeed): ApprovalState {
	return {
		phase: "open",
		ownerId: seed.ownerId,
		ownerPublicKeyPem: seed.ownerPublicKeyPem,
		now: seed.now,
		maxTtlMs: seed.maxTtlMs,
		issued: seed.issued.map((record) => ({ ...record })),
		spent: [],
		audit: [],
		trace: null,
		canonicalBytes: "",
		authenticatorLabel: "",
		authenticatorKind: "",
		provesUserPresence: false,
	};
}

function stored(
	state: ApprovalState,
	challengeId: string,
): IssuedChallenge | undefined {
	return state.issued.find((record) => record.challengeId === challengeId);
}

export function challengeKnown(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): boolean {
	return stored(state, signed.challengeId) !== undefined;
}

export function hasValidChallenge(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): boolean {
	const record = stored(state, signed.challengeId);
	if (!record) return false;
	if (state.spent.includes(signed.challengeId)) return false;
	if (record.exp - record.issuedAt > state.maxTtlMs) return false;
	if (state.now < record.issuedAt) return false;
	if (state.now > record.exp) return false;
	if (signed.nonce !== record.nonce) return false;
	if (signed.issuedAt !== record.issuedAt) return false;
	if (signed.exp !== record.exp) return false;
	return true;
}

export function actorIsHuman(signed: SignedApprovalEvent): boolean {
	return signed.actor.kind === "human";
}

export function isOwner(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): boolean {
	return signed.actor.kind === "human" && signed.actor.id === state.ownerId;
}

export function approvalBinds(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): boolean {
	const record = stored(state, signed.challengeId);
	if (!record) return false;
	const recomputed = hashBinding({
		canonicalBytes: signed.canonicalBytes,
		challengeId: signed.challengeId,
		nonce: signed.nonce,
		issuedAt: signed.issuedAt,
		exp: signed.exp,
	});
	return (
		recomputed === record.bindingHash &&
		signed.bindingHash === record.bindingHash
	);
}

export function signatureHolds(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): boolean {
	if (!signed.signature) return false;
	try {
		const digest = bindingDigest({
			canonicalBytes: signed.canonicalBytes,
			challengeId: signed.challengeId,
			nonce: signed.nonce,
			issuedAt: signed.issuedAt,
			exp: signed.exp,
		});
		return verify(
			null,
			digest,
			createPublicKey(state.ownerPublicKeyPem),
			Buffer.from(signed.signature, "base64url"),
		);
	} catch {
		return false;
	}
}

function invalidChallengeCode(
	state: ApprovalState,
	signed: SignedApprovalEvent,
): string {
	const record = stored(state, signed.challengeId);
	if (!record) return "unknown_challenge";
	if (state.spent.includes(signed.challengeId)) return "replay";
	if (record.exp - record.issuedAt > state.maxTtlMs) return "ttl_too_long";
	if (state.now < record.issuedAt) return "not_yet_valid";
	if (state.now > record.exp) return "expired";
	return "has_valid_challenge";
}

function submittedMove(canonicalBytes: string): string {
	return confirmViewFromBytes(canonicalBytes).moves[0]?.move ?? "unknown";
}

function audit(
	signed: SignedApprovalEvent,
	event: "approved" | "refused",
	code?: string,
): Effect {
	return {
		type: "audit",
		entry: {
			event,
			challengeId: signed.challengeId,
			actor: signed.actor.id,
			move: submittedMove(signed.canonicalBytes),
			...(code === undefined ? {} : { code }),
		},
	};
}

function base(
	state: ApprovalState,
	signed: SignedApprovalEvent,
	guards: GuardResults,
) {
	return {
		from: state.phase,
		event: "SUBMIT_SIGNED" as const,
		actor: { id: signed.actor.id, kind: signed.actor.kind },
		guards,
	};
}

/**
 * Pure decision. The first failing guard is the refusal. Later guards are
 * not run. Spend is named as an effect once the challenge is known and still
 * valid, including when a later guard refuses.
 */
export function step(state: ApprovalState, signed: SignedApprovalEvent): Trace {
	const guards: GuardResults = {};
	guards.challengeKnown = challengeKnown(state, signed);
	if (!guards.challengeKnown) {
		return {
			...base(state, signed, guards),
			refusal: { guard: "challengeKnown", code: "unknown_challenge" },
			effects: [audit(signed, "refused", "unknown_challenge")],
		};
	}

	guards.hasValidChallenge = hasValidChallenge(state, signed);
	if (!guards.hasValidChallenge) {
		const code = invalidChallengeCode(state, signed);
		return {
			...base(state, signed, guards),
			refusal: { guard: "hasValidChallenge", code },
			effects: [audit(signed, "refused", code)],
		};
	}

	const spent: Effect[] = [
		{ type: "spendChallenge", challengeId: signed.challengeId },
	];

	guards.actorIsHuman = actorIsHuman(signed);
	if (!guards.actorIsHuman) {
		const code = `agent_cannot_${submittedMove(signed.canonicalBytes)}`;
		return {
			...base(state, signed, guards),
			refusal: { guard: "actorIsHuman", code },
			effects: [...spent, audit(signed, "refused", code)],
		};
	}

	guards.isOwner = isOwner(state, signed);
	if (!guards.isOwner) {
		return {
			...base(state, signed, guards),
			refusal: { guard: "isOwner", code: "wrong_actor" },
			effects: [...spent, audit(signed, "refused", "wrong_actor")],
		};
	}

	guards.approvalBinds = approvalBinds(state, signed);
	if (!guards.approvalBinds) {
		return {
			...base(state, signed, guards),
			refusal: { guard: "approvalBinds", code: "action_mismatch" },
			effects: [...spent, audit(signed, "refused", "action_mismatch")],
		};
	}

	guards.signatureHolds = signatureHolds(state, signed);
	if (!guards.signatureHolds) {
		const code = signed.signature ? "bad_signature" : "missing_signature";
		return {
			...base(state, signed, guards),
			refusal: { guard: "signatureHolds", code },
			effects: [...spent, audit(signed, "refused", code)],
		};
	}

	return {
		...base(state, signed, guards),
		to: state.phase,
		effects: [...spent, audit(signed, "approved")],
	};
}

/** Commits the effects `step` named. Does not decide. */
export function applyEffects(
	state: ApprovalState,
	trace: Trace,
): ApprovalState {
	let spent = state.spent;
	let auditLog = state.audit;
	for (const effect of trace.effects) {
		if (
			effect.type === "spendChallenge" &&
			!spent.includes(effect.challengeId)
		) {
			spent = [...spent, effect.challengeId];
		}
		if (effect.type === "audit") {
			const entry: AuditEntry = { seq: auditLog.length + 1, ...effect.entry };
			auditLog = [...auditLog, entry];
		}
	}
	return { ...state, spent, audit: auditLog, trace };
}
