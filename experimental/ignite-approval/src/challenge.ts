/**
 * Port for a server-issued challenge. The helper calls `issue` and keeps the
 * result. It does not spend a challenge and it does not decide the action.
 */
export type IssuedChallenge = {
	readonly challengeId: string;
	readonly nonce: string;
	readonly issuedAt: number;
	readonly exp: number;
	/** Hex SHA-256 of the binding document. This is the WebAuthn challenge. */
	readonly bindingHash: string;
};

export type ChallengeClient = {
	issue(input: { readonly canonicalBytes: string }): Promise<IssuedChallenge>;
};

/** What the helper asks an authenticator to sign. */
export type AuthenticationCeremony = {
	readonly challenge: string;
	readonly userPresence: "required";
	readonly userVerification: "required";
};

export type AuthenticatorAssertion =
	| {
			readonly kind: "test-ed25519";
			readonly label: string;
			readonly provesUserPresence: boolean;
			readonly provesUserVerification: boolean;
			readonly simulatedFlags?: {
				readonly up?: boolean;
				readonly uv?: boolean;
			};
			readonly signature: string;
	  }
	| {
			readonly kind: "webauthn";
			readonly challenge?: string;
			readonly flags?: { readonly up?: boolean; readonly uv?: boolean };
			readonly signature: string;
	  };

export type AuthenticatorPort = {
	assert(
		ceremony: AuthenticationCeremony,
		bindingHash: string,
	): Promise<AuthenticatorAssertion | null>;
};
