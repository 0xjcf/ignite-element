import { randomBytes } from "node:crypto";
import { hashBinding } from "./binding";
import type { ChallengeClient, IssuedChallenge } from "./challenge";

/**
 * TEST double for the challenge port. It issues random ids and a binding hash.
 * It does not speak WebAuthn, and it does not spend. The host reads `issued()`
 * and copies those records into the machine. The helper cannot.
 */
export function createMemoryChallengeClient(options: {
	readonly ttlMs: number;
	readonly maxTtlMs: number;
	readonly now: () => number;
}): ChallengeClient & { issued(): readonly IssuedChallenge[] } {
	if (options.ttlMs > options.maxTtlMs) {
		throw new Error("ttlMs exceeds maxTtlMs");
	}
	const records: IssuedChallenge[] = [];
	return {
		async issue(input) {
			const issuedAt = options.now();
			const challengeId = randomBytes(16).toString("base64url");
			const nonce = randomBytes(32).toString("base64url");
			const exp = issuedAt + options.ttlMs;
			const record: IssuedChallenge = {
				challengeId,
				nonce,
				issuedAt,
				exp,
				bindingHash: hashBinding({
					canonicalBytes: input.canonicalBytes,
					challengeId,
					nonce,
					issuedAt,
					exp,
				}),
			};
			records.push(record);
			return record;
		},
		issued() {
			return records.map((record) => ({ ...record }));
		},
	};
}
