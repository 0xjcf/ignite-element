/**
 * Dev-only notice that no CSP is visible to script.
 *
 * HTTP response headers are invisible here. A meta policy counts.
 * A host that sent a header calls acknowledgeContentSecurityPolicy()
 * once so the notice stays quiet.
 *
 * Production library builds set __IGNITE_DEV_WARNINGS__ to false.
 * Both functions then return before any read, and a bundler deletes
 * the rest. Do not call this from a render path.
 */
declare const __IGNITE_DEV_WARNINGS__: boolean;

type CspDocument = {
	querySelector(
		selectors: string,
	): { getAttribute(name: string): string | null } | null;
};

type CspGlobal = typeof globalThis & {
	document?: CspDocument;
};

let acknowledged = false;
let warned = false;

export function acknowledgeContentSecurityPolicy(): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	acknowledged = true;
}

export function warnIfNoContentSecurityPolicy(): void {
	if (!__IGNITE_DEV_WARNINGS__) return;
	if (acknowledged || warned) return;
	const doc = (globalThis as CspGlobal).document;
	if (doc === undefined) return;
	const meta = doc.querySelector(
		'meta[http-equiv="Content-Security-Policy" i]',
	);
	if (meta?.getAttribute("content")) return;
	warned = true;
	console.warn(
		"[ignite] No Content-Security-Policy is visible. A response header cannot be read from script. Call acknowledgeContentSecurityPolicy() after sending one, or add a meta policy. This notice is compiled out of production.",
	);
}
