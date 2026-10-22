import { executableUriPattern, uriSpacePattern } from "./executableUri";

const TRUSTED_STYLE = Symbol.for("ignite-element.trustedStyle");
const URL_FN = /url\s*\(/i;
const EXTRA_URL = /^(?:srcset|poster|background|cite|ping)$/;
const DATA_DOCUMENT = /^(?:script|iframe|frame|object|embed|applet)$/;
const HTML_SPACE = /[\t\n\f\r ]+/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEME = new Set(["http", "https", "mailto", "tel"]);

export type SafeSpreadOptions = {
	/** Function handlers kept by exact key, for example "onClick". */
	handlers?: readonly string[];
};

export function isForbiddenProp(key: string): boolean {
	return key === "__proto__" || key === "constructor" || key === "prototype";
}

export function isExtraUrlName(name: string): boolean {
	return EXTRA_URL.test(name.toLowerCase());
}

function stripped(value: string): string {
	uriSpacePattern.lastIndex = 0;
	return value.replace(uriSpacePattern, "").toLowerCase();
}

function executable(value: string, tag: string): boolean {
	const normalized = stripped(value);
	return (
		executableUriPattern.test(normalized) ||
		(normalized.startsWith("data:") && DATA_DOCUMENT.test(tag))
	);
}

/** True when a guarded URL attribute must not be written. */
export function urlValueBlocked(
	name: string,
	value: string,
	tag: string,
): boolean {
	const key = name.toLowerCase();
	if (key === "srcset") {
		for (const candidate of value.split(",")) {
			if (executable(candidate, tag)) return true;
		}
		return false;
	}
	if (key === "ping") {
		// The stripped whole value catches a scheme split by whitespace.
		// Tokens catch a safe URL beside a dangerous one, which the strip
		// would glue into a single harmless-looking string.
		if (executable(value, tag)) return true;
		for (const token of value.split(HTML_SPACE)) {
			if (token && executable(token, tag)) return true;
		}
		return false;
	}
	return executable(value, tag);
}

export function readTrustedStyle(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const css = (value as Record<symbol, unknown>)[TRUSTED_STYLE];
	return typeof css === "string" ? css : undefined;
}

export function trustedStyle(css: string) {
	if (typeof css !== "string") {
		throw new TypeError("trustedStyle expects a string");
	}
	return Object.freeze({ [TRUSTED_STYLE]: css });
}

/**
 * Style text nodes are concatenated by the CSS parser, including across
 * comments. Filter that joined string. A `;` declaration that contains
 * `url(` is kept only when every character of that declaration is
 * trustedStyle text.
 */
export function styleSheetFromChildren(
	children: ReadonlyArray<{ kind: string; value?: string; trusted?: boolean }>,
): { css: string; droppedUrl: boolean } {
	let full = "";
	const trustedAt: boolean[] = [];
	for (const child of children) {
		if (child.kind !== "text" || typeof child.value !== "string") continue;
		full += child.value;
		const trusted = child.trusted === true;
		for (let index = 0; index < child.value.length; index += 1) {
			trustedAt.push(trusted);
		}
	}
	const parts = full.split(";");
	const kept: string[] = [];
	let droppedUrl = false;
	let offset = 0;
	for (const part of parts) {
		let drop = false;
		if (URL_FN.test(part)) {
			for (let index = offset; index < offset + part.length; index += 1) {
				if (!trustedAt[index]) {
					drop = true;
					break;
				}
			}
		}
		if (drop) droppedUrl = true;
		else kept.push(part);
		offset += part.length + 1;
	}
	return { css: kept.join(";"), droppedUrl };
}

export function cssTextWithoutUrls(value: string): string {
	return styleSheetFromChildren([{ kind: "text", value, trusted: false }]).css;
}

/** `false` drops the property. `undefined` leaves it alone. A string is set. */
export function cssValueForStyle(value: unknown): string | false | undefined {
	const trusted = readTrustedStyle(value);
	if (trusted !== undefined) return trusted;
	if (value == null) return undefined;
	const text = String(value);
	if (URL_FN.test(text)) return false;
	return text;
}

export function scriptElementOmitted(
	children: ReadonlyArray<{ kind: string }>,
): boolean {
	return children.some((child) => child.kind === "text");
}

function isHandlerKey(key: string): boolean {
	return key.length > 2 && key.toLowerCase().startsWith("on");
}

export function safeUrl(value: string): string | null {
	if (typeof value !== "string") return null;
	const normalized = stripped(value);
	if (normalized.length === 0) return null;
	const match = SCHEME.exec(normalized);
	if (!match) return value;
	const scheme = match[1];
	if (scheme && ALLOWED_SCHEME.has(scheme.toLowerCase())) return value;
	return null;
}

export function safeSpread(
	props: object,
	options?: SafeSpreadOptions,
): Record<string, unknown> {
	if (props === null || typeof props !== "object") return {};
	const allowed = new Set(options?.handlers ?? []);
	const source = props as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(source)) {
		if (isForbiddenProp(key)) continue;
		const value = source[key];
		if (isHandlerKey(key)) {
			if (typeof value === "function" && allowed.has(key)) out[key] = value;
			continue;
		}
		out[key] = value;
	}
	return out;
}
