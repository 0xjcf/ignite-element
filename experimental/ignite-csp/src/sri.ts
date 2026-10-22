import { createHash } from "node:crypto";

/**
 * Subresource Integrity token for a hosted file.
 * sha384 is the baseline browsers still require alongside sha256.
 * Publish one token per dist file. A nonce does not check bytes.
 */
export function subresourceIntegrity(bytes: Uint8Array): string {
	const digest = createHash("sha384").update(bytes).digest("base64");
	return `sha384-${digest}`;
}
