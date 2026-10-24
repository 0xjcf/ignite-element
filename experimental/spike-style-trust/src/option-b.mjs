import {
	AUTHOR_WARNING,
	commitProps,
	filterSheet,
	filterStyleAttribute,
	loaderBlocked,
	scriptableBlocked,
} from "./policy.mjs";

const REMOTE_LOAD =
	/(?:@import\b|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|\burl\s*\()/i;

/**
 * Svelte/Vue-style runtime rule. `<style>` children keep remote loads
 * (`url()`, `@import`, `image-set`, `src()`, backslashes). expression(,
 * behavior, -moz-binding, and a breakout still drop, because those are
 * script and markup, not a font or an image. `style={}` stays fully
 * filtered. At runtime a literal and an interpolated string are the same
 * value, so a dev warning is the only signal that a load was trusted.
 */
export function renderB(view, options = {}) {
	const dev = options.dev === true;
	const warnings = [];
	const styleAttribute = filterStyleAttribute(view.style, loaderBlocked);
	const joined = joinChildren(view.styleChildren);
	const styleElement = filterSheet(joined, scriptableBlocked).css;
	if (dev && REMOTE_LOAD.test(styleElement)) warnings.push(AUTHOR_WARNING);
	const committed = commitProps(view.props);
	return { styleAttribute, styleElement, warnings, ...committed };
}

function joinChildren(children) {
	if (typeof children === "string") return children;
	if (!Array.isArray(children)) return "";
	return children.map((part) => (typeof part === "string" ? part : "")).join("");
}

export { filterSheet };
