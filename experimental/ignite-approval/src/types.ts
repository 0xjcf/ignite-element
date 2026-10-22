/** Actor on a signed event. The helper records it. The machine decides. */
export type Actor = {
	readonly id: string;
	readonly kind: "human" | "agent";
};

export type AuthenticatorKind = "test-ed25519" | "webauthn";

/**
 * What the helper returns after a ceremony. `provesUserPresence` is false for
 * the Ed25519 test authenticator: a software key does not prove user presence.
 */
export type AuthenticatorMark =
	| {
			readonly kind: "test-ed25519";
			readonly label: string;
			readonly provesUserPresence: false;
			readonly provesUserVerification: false;
	  }
	| {
			readonly kind: "webauthn";
			readonly label: string;
			readonly provesUserPresence: true;
			readonly provesUserVerification: true;
	  };

/** The only output of the helper: a signature over canonical bytes, not a verdict. */
export type SignedApprovalEvent = {
	readonly type: "SIGNED";
	readonly actor: Actor;
	readonly canonicalBytes: string;
	readonly challengeId: string;
	readonly nonce: string;
	readonly issuedAt: number;
	readonly exp: number;
	readonly bindingHash: string;
	readonly signature: string;
	readonly authenticator: AuthenticatorMark;
};

export type BindingParts = {
	readonly canonicalBytes: string;
	readonly challengeId: string;
	readonly nonce: string;
	readonly issuedAt: number;
	readonly exp: number;
};
