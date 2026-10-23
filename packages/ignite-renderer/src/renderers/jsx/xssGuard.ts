import { uriSpacePattern } from "./executableUri";
import type { IgniteJsxChild } from "./types";

const TRUSTED_STYLE = Symbol.for("ignite-element.trustedStyle");
declare const trustedStyleBrand: unique symbol;
// Remote CSS loads, old scriptable properties, and url( after a comment
// is stripped. A backslash is rejected separately and is not decoded.
const CSS_LOADER =
	/(?:@import\b|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|\burl\s*\(|expression\s*\(|-moz-binding|(?:^|[^-\w])behavior\b)/i;
const EXTRA_URL =
	/^(?:srcset|imagesrcset|poster|background|cite|ping|manifest)$/;
const SVG_PAINT =
	/^(?:fill|stroke|filter|mask|clip-?path|marker(?:-?(?:start|mid|end))?|cursor)$/;
// The whole value, not a span up to the first ")". Id has no space, quote, or paren.
const LOCAL_FRAGMENT = /^url\((?:#[^)\s'"(]*|(["'])#[^)\s'"(]*\1)\)$/i;
const URL_PART =
	/^(?:host(?:name)?|protocol|port|pathname|origin|username|password|search|hash)$/i;
const BLOCKED_REL = /^(?:stylesheet|preload|modulepreload|import)$/;
const RASTER_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif)(?![+a-z])/;
const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;
// `</style` and `<!` break out of a style element when HTML is reparsed.
// Whitespace may sit between the characters. A `<` comparison stays.
const STYLE_END = /<\s*\/\s*style/i;
const STYLE_BREAK = /<\s*[/!]/;
const HTML_SPACE = /[\t\n\f\r ]+/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEME = new Set(["http", "https", "mailto", "tel"]);
// //host, \\host, /\host, and \/host. Checked on the stripped value.
const PROTOCOL_RELATIVE = /^[\\/]{2}/;
// WHATWG GlobalEventHandlers, plus animationend, transitionend,
// selectstart, command, and pagereveal, plus names current browsers do
// not put on HTMLElement, Window, Document, SVGElement, window, or
// document. The prototype check covers anything this list misses.
const RARE_EVENTS =
	" abort auxclick beforeinput beforematch beforetoggle blur cancel canplay canplaythrough change click close command contextlost contextmenu contextrestored copy cuechange cut dblclick drag dragend dragenter dragleave dragover dragstart drop durationchange emptied ended error focus formdata input invalid keydown keypress keyup load loadeddata loadedmetadata loadstart mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup paste pause play playing progress ratechange reset resize scroll scrollend securitypolicyviolation seeked seeking select slotchange stalled submit suspend timeupdate toggle volumechange waiting webkitanimationend webkitanimationiteration webkitanimationstart webkittransitionend wheel animationend transitionend selectstart pagereveal animationcancel begin bounce compositionend compositionstart compositionupdate encrypted end enterpictureinpicture finish focusin focusout leavepictureinpicture loadend repeat search start waitingforkey ";

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

function urlAllowed(value: string): boolean {
	return safeUrl(value) !== null;
}

function rasterData(value: string): boolean {
	return RASTER_DATA.test(stripped(value));
}

function withoutComments(text: string): string {
	COMMENT_BLOCK.lastIndex = 0;
	return text.replace(COMMENT_BLOCK, "");
}

export function decorativeUrlBlocked(
	tag: string,
	name: string,
	value: unknown,
): boolean {
	const smil =
		(tag === "animate" || tag === "set" || tag === "animatemotion") &&
		(name === "from" || name === "to" || name === "by" || name === "values");
	if (!smil && !SVG_PAINT.test(name)) return false;
	if (value == null || value === false) return false;
	// One read. A later toString() can swap "#safe" for a remote url().
	if (typeof value !== "string") return true;
	// url(#id), url("#id"), or url('#id'). Every other value takes the loader check.
	if (LOCAL_FRAGMENT.test(value)) return false;
	return untrustedCssBlocked(value);
}

/** True when a guarded URL attribute must not be written. */
export function urlValueBlocked(
	name: string,
	value: string,
	tag = "",
): boolean {
	const key = name.toLowerCase();
	// http(s) navigates a nested document. A same-document path stays.
	const nested =
		(key === "src" &&
			(tag === "iframe" || tag === "frame" || tag === "embed")) ||
		(key === "data" && tag === "object");
	if (nested && /^https?:/.test(stripped(value))) return true;
	const image = tag === "img" || tag === "source";
	if (key === "srcset" || key === "imagesrcset") {
		for (const candidate of srcsetCandidates(value)) {
			if (image && rasterData(candidate)) continue;
			if (!urlAllowed(candidate)) return true;
		}
		return false;
	}
	if (image && key === "src" && rasterData(value)) return false;
	if (key === "ping") {
		// The whole value catches a scheme split by whitespace.
		// Tokens catch a safe URL beside a dangerous one, which the strip
		// would glue into a single harmless-looking string.
		if (!urlAllowed(value)) return true;
		for (const token of value.split(HTML_SPACE)) {
			if (token && !urlAllowed(token)) return true;
		}
		return false;
	}
	return !urlAllowed(value);
}

export function readTrustedStyle(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const css = (value as Record<symbol, unknown>)[TRUSTED_STYLE];
	return typeof css === "string" ? css : undefined;
}

export interface TrustedStyle {
	// `type` is absent at runtime. The optional name overlaps the host view
	// shape, which is a weak type, so this child does not kick JSX elements
	// out of that shape.
	readonly type?: undefined;
	readonly [trustedStyleBrand]: string;
}

type _AssertChild<T extends IgniteJsxChild> = T;
export type TrustedStyleIsChild = _AssertChild<TrustedStyle>;

export function trustedStyle(css: string): TrustedStyle {
	// No valid CSS needs a style end tag. Reject it before it is branded.
	if (typeof css !== "string" || STYLE_END.test(css)) {
		throw new TypeError("trustedStyle expects a string");
	}
	const branded: TrustedStyle = Object.freeze({
		[TRUSTED_STYLE]: css,
	}) as unknown as TrustedStyle;
	return branded;
}

/**
 * Declaration spans. Semicolons, `{`, and `}` inside quotes or comments are
 * not splits. `depth` is the brace depth after the span. It is not reset, so
 * a later rule stays outside a block whose declaration was dropped.
 */
function declarationSpans(
	full: string,
): Array<{ start: number; end: number; depth: number }> {
	const spans: Array<{ start: number; end: number; depth: number }> = [];
	let start = 0;
	let quote = "";
	let comment = false;
	let index = 0;
	let depth = 0;
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
		if (char === "{" || char === ";" || char === "}") {
			if (char === "{") depth += 1;
			else if (char === "}") depth -= 1;
			const end = char === ";" ? index : index + 1;
			if (end > start) spans.push({ start, end, depth });
			start = index + 1;
			index += 1;
			continue;
		}
		index += 1;
	}
	if (full.length > start) spans.push({ start, end: full.length, depth });
	return spans;
}

/**
 * Style text nodes are concatenated by the CSS parser, including across
 * comments. Filter that joined string. A declaration that loads a URL is
 * kept only when every character of that declaration, including a closing
 * brace, is trustedStyle text. A dropped declaration that closed blocks
 * writes those closes before the next kept rule, so that rule is not
 * pulled inside.
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
	// `</` or `<!` drops the whole sheet. A `<` comparison is not a breakout.
	if (STYLE_BREAK.test(full)) return { css: "", droppedUrl: true };
	let css = "";
	let droppedUrl = false;
	let open = 0;
	for (const span of declarationSpans(full)) {
		const part = full.slice(span.start, span.end);
		let drop = false;
		if (untrustedCssBlocked(part)) {
			for (let index = span.start; index < span.end; index += 1) {
				if (!trustedAt[index]) {
					drop = true;
					break;
				}
			}
		}
		if (drop) {
			droppedUrl = true;
			if (span.depth < open) {
				css += "}".repeat(open - span.depth);
				open = span.depth;
			}
			continue;
		}
		// A semicolon after `{` or `}` is not an empty rule. Chromium drops every later rule.
		if (css && !css.endsWith("}") && !css.endsWith("{")) css += ";";
		css += part;
		open = span.depth;
	}
	if (open > 0) css += "}".repeat(open);
	return { css, droppedUrl };
}

export function cssTextWithoutUrls(value: unknown): unknown {
	if (typeof value === "string") {
		return styleSheetFromChildren([{ kind: "text", value, trusted: false }])
			.css;
	}
	// A trusted style, a number, false, or null is the setter's value as given.
	if (
		!value ||
		typeof value !== "object" ||
		readTrustedStyle(value) !== undefined
	) {
		return value;
	}
	const source = value as Record<string, unknown>;
	// One read per own key. The setter gets that copy, not a live toString
	// or a prototype that still holds a loader. Null stays null. A number
	// is the string from that single read, so 0 arrives as "0".
	const out: Record<string, string | null> = {};
	for (const name of Object.keys(source)) {
		// A key is serialized as a declaration. `background:url(...);color` is a load.
		// `/*` or `*/` in a key or value rebuilds `url(` when a setter joins values.
		if (untrustedCssBlocked(name) || commentSplit(name)) continue;
		const raw = source[name];
		if (raw === null) {
			out[name] = null;
			continue;
		}
		const checked = cssValueForStyle(raw);
		// `background:u/*` plus `*/rl(...)` is a loader only after the join.
		if (
			typeof checked === "string" &&
			!commentSplit(checked) &&
			!untrustedCssBlocked(`${name}:${checked}`)
		) {
			out[name] = checked;
		}
	}
	return out;
}

/** `false` drops the property. `undefined` leaves it alone. A string is set. */
export function cssValueForStyle(value: unknown): string | false | undefined {
	const trusted = readTrustedStyle(value);
	if (trusted !== undefined) return trusted;
	if (value == null) return undefined;
	const text = String(value);
	if (untrustedCssBlocked(text)) return false;
	return text;
}

function commentSplit(text: string): boolean {
	return /\/\*|\*\//.test(text);
}

function untrustedCssBlocked(text: string): boolean {
	// Raw text catches a loader a string-delimited `/*` would hide.
	// Comment removal catches `url /**/ (`.
	return (
		text.includes("\\") ||
		CSS_LOADER.test(text) ||
		CSS_LOADER.test(withoutComments(text))
	);
}

function loads(value: unknown): boolean {
	return value != null && value !== false;
}

/** Own `src`, `href`, or `xlink:href`, including a namespace prefix. */
function isScriptSourceKey(key: string): boolean {
	const name = localName(key);
	return name === "src" || name === "href" || name === "xlinkhref";
}

export function scriptElementOmitted(
	children: ReadonlyArray<{ kind: string }>,
	props?: object,
): boolean {
	if (
		children.some((child) => child.kind === "text" || child.kind === "element")
	) {
		return true;
	}
	if (!props) return false;
	for (const key of Object.keys(props)) {
		// Presence omits the element. false, null, undefined, "", and 0 count.
		if (isScriptSourceKey(key)) return true;
	}
	return false;
}

function blockedRelText(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(blockedRelText);
	if (!loads(value)) return false;
	const text = typeof value === "string" ? value : String(value);
	for (const token of text.split(HTML_SPACE)) {
		if (BLOCKED_REL.test(token.toLowerCase())) return true;
	}
	return false;
}

// biome-ignore format: line breaks here show up in the minified gzip budget
export function snapshotLinkRel(props: object): object | false {
	const next = { ...(props as Record<string, unknown>) };
	for (const key of Object.keys(next)) if (/^(?:rel|rellist)$/i.test(key)) {
		const value = next[key];
		// toString that returns an object makes String() throw. Omit the link.
		try { if (typeof value !== "string" && loads(value)) next[key] = String(value).replace(/,/g, " "); }
		catch { return false; }
		if (blockedRelText(next[key])) return false;
	}
	return next;
}

export function isUrlPartKey(key: string): boolean {
	return URL_PART.test(key);
}

/** Local name with any namespace prefix removed. */
export function localName(value: string): string {
	const lower = value.toLowerCase();
	const colon = lower.lastIndexOf(":");
	return colon < 0 ? lower : lower.slice(colon + 1);
}

/** True after props apply when a link's reflected rel is a blocked token. */
export function linkReflectsBlocked(element: Element): boolean {
	if (localName(element.localName) !== "link") return false;
	const list = (element as HTMLLinkElement).relList;
	return blockedRelText(list ? list.value : element.getAttribute("rel"));
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
	if (PROTOCOL_RELATIVE.test(normalized)) return null;
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
		if (
			isForbiddenProp(key) ||
			MARKUP_PROP.test(key) ||
			isUrlPartKey(key) ||
			key.toLowerCase() === "rellist"
		) {
			continue;
		}
		const value = source[key];
		if (isHandlerKey(key)) {
			if (typeof value === "function" && allowed.has(key)) out[key] = value;
			continue;
		}
		out[key] = value;
	}
	return out;
}
