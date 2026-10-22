import { createHash } from "node:crypto";
import { canonicalizeJson, type Json } from "./canonicalize";
import type { BindingParts } from "./types";

/**
 * SHA-256 preimage for the WebAuthn challenge: JCS of the canonical payload
 * together with the server-issued challenge id, nonce, issuedAt, and exp.
 * JCS avoids ambiguous concatenation. A raw byte layout is an open question
 * until ledger's signing payload is confirmed.
 */
export function bindingDocument(parts: BindingParts): Json {
	return {
		canonicalPayload: parts.canonicalBytes,
		challengeId: parts.challengeId,
		exp: parts.exp,
		issuedAt: parts.issuedAt,
		nonce: parts.nonce,
	};
}

export function bindingDigest(parts: BindingParts): Buffer {
	return createHash("sha256")
		.update(canonicalizeJson(bindingDocument(parts)))
		.digest();
}

export function hashBinding(parts: BindingParts): string {
	return bindingDigest(parts).toString("hex");
}
