import { executableUriPattern, uriSpacePattern } from "./executableUri";
import type { IgniteJsxChild } from "./types";

const TRUSTED_STYLE = Symbol.for("ignite-element.trustedStyle");
declare const trustedStyleBrand: unique symbol;
// url( plus the other CSS ways to load a remote resource. A backslash
// escape that spells one of these is intentionally not decoded.
const CSS_LOADER =
	/(?:@import\b|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|\burl\s*\()/i;
const EXTRA_URL = /^(?:srcset|poster|background|cite|ping)$/;
const DATA_DOCUMENT = /^(?:script|iframe|frame|object|embed|applet)$/;
const DATA_XML =
	/^data:(?:text\/xml|application\/xml|[a-z0-9.+-]+\/[a-z0-9.+-]+\+xml)(?:;|,|$)/;
const HTML_SPACE = /[\t\n\f\r ]+/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEME = new Set(["http", "https", "mailto", "tel"]);
// Event names this renderer's DOM may not expose on HTMLElement, Window,
// Document, or SVGElement. Names those prototypes do expose are handlers too.
const RARE_EVENTS =
	" animationcancel animationend animationiteration animationstart appinstalled beforecopy beforecut beforeinstallprompt beforepaste beforexrselect begin bounce command compositionend compositionstart compositionupdate contentvisibilityautostatechange encrypted end enterpictureinpicture finish focusin focusout freeze fullscreenchange fullscreenerror gamepadconnected gamepaddisconnected leavepictureinpicture loadend mousewheel pagereveal pageswap pointerlockchange pointerlockerror prerenderingchange repeat resume scrollsnapchange scrollsnapchanging search selectionchange selectstart slotchange start transitioncancel transitionend transitionrun transitionstart waitingforkey webkitfullscreenchange webkitfullscreenerror ";

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
		DATA_XML.test(normalized) ||
		(normalized.startsWith("data:") && DATA_DOCUMENT.test(tag))
	);
}

function isHtmlSpace(char: string): boolean {
	return (
		char === " " ||
		char === "\t" ||
		char === "\n" ||
		char === "\f" ||
		char === "\r"
	);
}

/**
 * HTML srcset candidates, URL plus descriptors. A comma inside the URL
 * token stays in that candidate. The caller strips each candidate, so a
 * scheme split by whitespace is still visible.
 */
export function srcsetCandidates(value: string): string[] {
	const candidates: string[] = [];
	let index = 0;
	const length = value.length;
	while (index < length) {
		while (
			index < length &&
			(isHtmlSpace(value[index] ?? "") || value[index] === ",")
		) {
			index += 1;
		}
		if (index >= length) break;
		const start = index;
		let url = "";
		while (index < length && !isHtmlSpace(value[index] ?? "")) {
			url += value[index];
			index += 1;
		}
		if (url.endsWith(",")) {
			url = url.replace(/,+$/, "");
			if (url.length > 0) candidates.push(url);
			continue;
		}
		let end = index;
		while (index < length) {
			while (index < length && isHtmlSpace(value[index] ?? "")) index += 1;
			if (index >= length) {
				end = index;
				break;
			}
			if (value[index] === ",") {
				end = index;
				index += 1;
				break;
			}
			while (
				index < length &&
				!isHtmlSpace(value[index] ?? "") &&
				value[index] !== ","
			) {
				index += 1;
			}
			end = index;
			if (index < length && value[index] === ",") {
				index += 1;
				break;
			}
		}
		const candidate = value.slice(start, end);
		if (candidate.length > 0) candidates.push(candidate);
	}
	return candidates;
}

/** True when a guarded URL attribute must not be written. */
export function urlValueBlocked(
	name: string,
	value: string,
	tag: string,
): boolean {
	const key = name.toLowerCase();
	if (key === "srcset") {
		for (const candidate of srcsetCandidates(value)) {
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

export interface TrustedStyle {
	readonly [trustedStyleBrand]: string;
}

type _AssertChild<T extends IgniteJsxChild> = T;
export type TrustedStyleIsChild = _AssertChild<TrustedStyle>;

export function trustedStyle(css: string): TrustedStyle {
	if (typeof css !== "string") {
		throw new TypeError("trustedStyle expects a string");
	}
	const branded: TrustedStyle = Object.freeze({
		[TRUSTED_STYLE]: css,
	}) as unknown as TrustedStyle;
	return branded;
}

/**
 * Declaration spans. Semicolons inside quotes or comments are not splits.
 * A backslash inside a quote skips the next character and is not decoded.
 */
function declarationSpans(full: string): Array<{ start: number; end: number }> {
	const spans: Array<{ start: number; end: number }> = [];
	let start = 0;
	let quote = "";
	let comment = false;
	let index = 0;
	while (index < full.length) {
		const char = full[index] ?? "";
		if (comment) {
			if (char === "*" && full[index + 1] === "/") {
				comment = false;
				index += 2;
				continue;
			}
			index += 1;
			continue;
		}
		if (quote) {
			if (char === "\\") {
				index += 2;
				continue;
			}
			if (char === quote) quote = "";
			index += 1;
			continue;
		}
		if (char === "/" && full[index + 1] === "*") {
			comment = true;
			index += 2;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			index += 1;
			continue;
		}
		if (char === ";") {
			spans.push({ start, end: index });
			start = index + 1;
		}
		index += 1;
	}
	spans.push({ start, end: full.length });
	return spans;
}

/**
 * Style text nodes are concatenated by the CSS parser, including across
 * comments. Filter that joined string. A declaration that loads a URL is
 * kept only when every character of that declaration is trustedStyle text.
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
	const kept: string[] = [];
	let droppedUrl = false;
	for (const span of declarationSpans(full)) {
		const part = full.slice(span.start, span.end);
		let drop = false;
		if (CSS_LOADER.test(part) || part.includes("\\")) {
			for (let index = span.start; index < span.end; index += 1) {
				if (!trustedAt[index]) {
					drop = true;
					break;
				}
			}
		}
		if (drop) droppedUrl = true;
		else kept.push(part);
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
	if (CSS_LOADER.test(text) || text.includes("\\")) return false;
	return text;
}

export function scriptElementOmitted(
	children: ReadonlyArray<{ kind: string }>,
): boolean {
	return children.some(
		(child) => child.kind === "text" || child.kind === "element",
	);
}

/** JSX `onClick`, or `on` plus a real event name in any ASCII case. */
export function isHandlerKey(key: string): boolean {
	if (/^on[A-Z]/.test(key)) return true;
	const lower = key.toLowerCase();
	if (lower.length < 3 || lower[0] !== "o" || lower[1] !== "n") return false;
	const name = lower.slice(2);
	const attr = `on${name}`;
	if (RARE_EVENTS.includes(` ${name} `)) return true;
	if (
		attr in HTMLElement.prototype ||
		attr in Window.prototype ||
		attr in Document.prototype ||
		attr in SVGElement.prototype
	) {
		return true;
	}
	return (
		(typeof window !== "undefined" && attr in window) ||
		(typeof document !== "undefined" && attr in document)
	);
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

const MARKUP_PROP =
	/^(?:text|textcontent|innertext|outertext|innerhtml|outerhtml|srcdoc|dangerouslysetinnerhtml)$/i;

export function safeSpread(
	props: object,
	options?: SafeSpreadOptions,
): Record<string, unknown> {
	if (props === null || typeof props !== "object") return {};
	const allowed = new Set(options?.handlers ?? []);
	const source = props as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(source)) {
		if (isForbiddenProp(key) || MARKUP_PROP.test(key)) continue;
		const value = source[key];
		if (isHandlerKey(key)) {
			if (typeof value === "function" && allowed.has(key)) out[key] = value;
			continue;
		}
		out[key] = value;
	}
	return out;
}
