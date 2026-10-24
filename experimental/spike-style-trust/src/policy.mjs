// Spike-only stand-in for the JSX style and URL rules.
// Not a package export. safeUrl and safeSpread are not defined here.

const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const PROTOCOL_RELATIVE = /^[\\/]{2}/;
const ALLOWED_SCHEME = new Set(["http", "https", "mailto", "tel"]);
const URL_KEY = /^(?:href|src|action|formaction|xlink:href)$/i;
const STYLE_BREAK = /<\s*[/!]/;

/** Remote loads plus the old scriptable CSS properties. Mirrors xssGuard CSS_LOADER. */
export const CSS_LOADER =
	/(?:@import\b|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|\burl\s*\(|expression\s*\(|-moz-binding|(?:^|[^-\w])behavior\b)/i;

/** Script and breakout only. No url(), @import, image-set, or src(. */
export const SCRIPTABLE =
	/(?:expression\s*\(|-moz-binding|(?:^|[^-\w])behavior\b)/i;

export const AUTHOR_WARNING =
	"[ignite-jsx] `<style>` text is author CSS and is not filtered. Do not interpolate props into it. Put data in a custom property (--x) on style={}.";

export function withoutComments(text) {
	return text.replace(COMMENT_BLOCK, "");
}

export function loaderBlocked(text) {
	return (
		text.includes("\\") ||
		CSS_LOADER.test(text) ||
		CSS_LOADER.test(withoutComments(text))
	);
}

export function scriptableBlocked(text) {
	return (
		SCRIPTABLE.test(text) || SCRIPTABLE.test(withoutComments(text))
	);
}

/**
 * Internal allowlist. The renderer calls this. Application code does not.
 * Same schemes as safeUrl: http, https, mailto, tel, and scheme-less
 * strings that are not protocol-relative.
 */
export function urlAllowed(value) {
	if (typeof value !== "string") return false;
	const normalized = value.replace(/[\u0000-\u0020\u007f]/g, "");
	if (normalized.length === 0) return false;
	if (PROTOCOL_RELATIVE.test(normalized)) return false;
	const match = SCHEME.exec(normalized);
	if (!match) return true;
	const scheme = match[1];
	return scheme ? ALLOWED_SCHEME.has(scheme.toLowerCase()) : false;
}

function declarationSpans(full) {
	const spans = [];
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

/** Drop blocked declarations. `</` and `<!` drop the whole sheet. */
export function filterSheet(full, blocked) {
	if (typeof full !== "string") return { css: "", dropped: false };
	if (STYLE_BREAK.test(full)) return { css: "", dropped: true };
	let css = "";
	let dropped = false;
	let open = 0;
	for (const span of declarationSpans(full)) {
		const part = full.slice(span.start, span.end);
		if (blocked(part)) {
			dropped = true;
			if (span.depth < open) {
				css += "}".repeat(open - span.depth);
				open = span.depth;
			}
			continue;
		}
		if (css && !css.endsWith("}") && !css.endsWith("{")) css += ";";
		css += part;
		open = span.depth;
	}
	if (open > 0) css += "}".repeat(open);
	return { css, dropped };
}

export function filterStyleAttribute(value, blocked, options = {}) {
	const paren = options.paren !== false;
	if (value == null || value === false) return undefined;
	if (typeof value === "string") return filterSheet(value, blocked).css;
	if (typeof value !== "object") return undefined;
	const out = {};
	for (const name of Object.keys(value)) {
		if (loaderKeyBlocked(name, blocked)) continue;
		const raw = value[name];
		if (raw == null) continue;
		const text = String(raw);
		if (
			blocked(text) ||
			blocked(`${name}:${text}`) ||
			(paren && /^\s*\(/.test(text))
		) {
			continue;
		}
		out[name] = text;
	}
	return out;
}

function loaderKeyBlocked(name, blocked) {
	return blocked(name) || /\/\*|\*\//.test(name);
}

/**
 * Props as they look once they reach jsx(). A direct onClick and a spread
 * onClick are the same shape, so this does not drop function handlers.
 * String handlers are dropped. URL attributes use the internal allowlist.
 */
export function commitProps(props) {
	const attrs = {};
	const listeners = [];
	if (!props || typeof props !== "object") return { attrs, listeners };
	for (const key of Object.keys(props)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype") {
			continue;
		}
		const value = props[key];
		if (URL_KEY.test(key)) {
			if (typeof value === "string" && urlAllowed(value)) attrs[key] = value;
			continue;
		}
		if (/^on/i.test(key) && key.length > 2) {
			if (typeof value === "function") listeners.push(key);
			continue;
		}
		attrs[key] = value;
	}
	return { attrs, listeners };
}

export function hasLoader(text) {
	return CSS_LOADER.test(text) || CSS_LOADER.test(withoutComments(text));
}
