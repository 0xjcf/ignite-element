/**
 * Recommended document policy for an ignite-element page.
 *
 * script-src is a per-response nonce plus 'strict-dynamic'. No
 * 'unsafe-inline'. No 'unsafe-eval'. style-src is 'self' only, so
 * external stylesheets load and inline style elements, style
 * attributes, cssText, and setProperty do not. Trusted Types are
 * required for script sinks. The only policy name allowed is ignite.
 *
 * The nonce is a placeholder for the server that stamps the HTML.
 * A nonce baked into a static file is not a nonce.
 */

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{8,128}$/;

export const IGNITE_CSP_HEADER = "Content-Security-Policy";

export function igniteContentSecurityPolicy(nonce: string): string {
	if (!NONCE_PATTERN.test(nonce)) {
		throw new Error(
			"CSP nonce must be 8–128 characters from [A-Za-z0-9+/=_-].",
		);
	}
	return [
		`script-src 'nonce-${nonce}' 'strict-dynamic'`,
		"object-src 'none'",
		"base-uri 'none'",
		"style-src 'self'",
		"require-trusted-types-for 'script'",
		"trusted-types ignite",
	].join("; ");
}
