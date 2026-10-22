import { type KeyObject, sign } from "node:crypto";
import type { AuthenticationCeremony, AuthenticatorPort } from "./challenge";

/**
 * TEST AUTHENTICATOR.
 * Ed25519 software key used in place of a hardware security key or passkey.
 * A software key does not prove user presence or user verification.
 * `simulatedFlags` are labels on this stub. They are not authenticator data,
 * and they are not copied onto the signed event as proof that a human touched
 * a device.
 */
export const TEST_AUTHENTICATOR_LABEL =
	"TEST authenticator: Ed25519 software key. A software key does not prove user presence or user verification.";

export function createTestAuthenticator(
	privateKey: KeyObject,
): AuthenticatorPort {
	return {
		async assert(ceremony: AuthenticationCeremony, bindingHash: string) {
			if (ceremony.userPresence !== "required") return null;
			if (ceremony.userVerification !== "required") return null;
			if (ceremony.challenge !== bindingHash) return null;
			if (!/^[0-9a-f]+$/u.test(bindingHash) || bindingHash.length % 2 !== 0) {
				return null;
			}
			const signature = sign(null, Buffer.from(bindingHash, "hex"), privateKey);
			return {
				kind: "test-ed25519" as const,
				label: TEST_AUTHENTICATOR_LABEL,
				provesUserPresence: false,
				provesUserVerification: false,
				simulatedFlags: { up: true, uv: true },
				signature: signature.toString("base64url"),
			};
		},
	};
}
