import { canonicalizeAction, type PendingAction } from "./canonicalize";
import type {
	AuthenticationCeremony,
	AuthenticatorAssertion,
	AuthenticatorPort,
	ChallengeClient,
} from "./challenge";
import { type ConfirmView, confirmViewFromBytes } from "./confirmView";
import { TEST_AUTHENTICATOR_LABEL } from "./testAuthenticator";
import type { Actor, AuthenticatorMark, SignedApprovalEvent } from "./types";

/**
 * Collects a signature over the canonical bytes of a pending action.
 * It does not approve, spend, or choose a next state. Missing ports and
 * unacceptable assertions produce no signed event (deny-by-default, same
 * posture as igniteTools when `canExecute` is absent).
 *
 * The Ed25519 authenticator shipped beside this file is a TEST stand-in.
 * A software key does not prove user presence.
 */
const NAMED_BIND_ERROR =
	"[igniteApproval] Named bind only: igniteApproval({ challenges, authenticator }). Without both ports, collect returns not_collected.";

export type Collection =
	| { readonly collected: false; readonly reason: "not_collected" }
	| { readonly collected: true; readonly event: SignedApprovalEvent };

export type IgniteApproval = {
	canonicalBytes(action: PendingAction): string;
	/** Confirm model parsed from the canonical bytes, not from the input object. */
	confirm(action: PendingAction): ConfirmView;
	collect(action: PendingAction, actor: Actor): Promise<Collection>;
};

const NOT_COLLECTED: Collection = { collected: false, reason: "not_collected" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChallengeClient(value: unknown): value is ChallengeClient {
	return isPlainObject(value) && typeof value.issue === "function";
}

function isAuthenticator(value: unknown): value is AuthenticatorPort {
	return isPlainObject(value) && typeof value.assert === "function";
}

function ceremonyFor(bindingHash: string): AuthenticationCeremony {
	return {
		challenge: bindingHash,
		userPresence: "required",
		userVerification: "required",
	};
}

function markFrom(
	assertion: AuthenticatorAssertion,
	bindingHash: string,
): AuthenticatorMark | null {
	if (!assertion.signature) return null;
	if (assertion.kind === "test-ed25519") {
		if (assertion.label !== TEST_AUTHENTICATOR_LABEL) return null;
		if (assertion.provesUserPresence !== false) return null;
		if (assertion.provesUserVerification !== false) return null;
		return {
			kind: "test-ed25519",
			label: TEST_AUTHENTICATOR_LABEL,
			provesUserPresence: false,
			provesUserVerification: false,
		};
	}
	if (assertion.flags?.up !== true || assertion.flags.uv !== true) return null;
	if (assertion.challenge !== bindingHash) return null;
	return {
		kind: "webauthn",
		label: "WebAuthn assertion",
		provesUserPresence: true,
		provesUserVerification: true,
	};
}

export function igniteApproval(options: unknown): IgniteApproval {
	if (!isPlainObject(options)) throw new Error(NAMED_BIND_ERROR);
	for (const key of Object.keys(options)) {
		if (key !== "challenges" && key !== "authenticator") {
			throw new Error(NAMED_BIND_ERROR);
		}
	}
	const challenges = options.challenges;
	const authenticator = options.authenticator;
	if (challenges !== undefined && !isChallengeClient(challenges)) {
		throw new Error(NAMED_BIND_ERROR);
	}
	if (authenticator !== undefined && !isAuthenticator(authenticator)) {
		throw new Error(NAMED_BIND_ERROR);
	}

	return {
		canonicalBytes(action) {
			return canonicalizeAction(action);
		},
		confirm(action) {
			return confirmViewFromBytes(canonicalizeAction(action));
		},
		async collect(action, actor) {
			if (!isChallengeClient(challenges) || !isAuthenticator(authenticator)) {
				return NOT_COLLECTED;
			}
			const canonicalBytes = canonicalizeAction(action);
			let issued: Awaited<ReturnType<ChallengeClient["issue"]>>;
			try {
				issued = await challenges.issue({ canonicalBytes });
			} catch {
				return NOT_COLLECTED;
			}
			if (
				!issued ||
				typeof issued.challengeId !== "string" ||
				typeof issued.nonce !== "string" ||
				typeof issued.bindingHash !== "string" ||
				typeof issued.issuedAt !== "number" ||
				typeof issued.exp !== "number"
			) {
				return NOT_COLLECTED;
			}
			let assertion: AuthenticatorAssertion | null;
			try {
				assertion = await authenticator.assert(
					ceremonyFor(issued.bindingHash),
					issued.bindingHash,
				);
			} catch {
				return NOT_COLLECTED;
			}
			if (!assertion) return NOT_COLLECTED;
			const authenticatorMark = markFrom(assertion, issued.bindingHash);
			if (!authenticatorMark) return NOT_COLLECTED;
			return {
				collected: true,
				event: {
					type: "SIGNED",
					actor,
					canonicalBytes,
					challengeId: issued.challengeId,
					nonce: issued.nonce,
					issuedAt: issued.issuedAt,
					exp: issued.exp,
					bindingHash: issued.bindingHash,
					signature: assertion.signature,
					authenticator: authenticatorMark,
				},
			};
		},
	};
}
