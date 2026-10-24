import {
	commitProps,
	filterSheet,
	filterStyleAttribute,
	loaderBlocked,
	scriptableBlocked,
} from "./policy.mjs";

// Module-local. Symbol.for would be forgeable. A second copy of this module
// fails closed: its objects are not this symbol, so the sheet is filtered.
const AUTHOR = Symbol("ignite-element.authorStyle");

/**
 * Compiler target. Not a public app helper. The Vite transform emits this
 * call for a static `<style>` string. An expression is left as a plain
 * string and the runtime filters it.
 */
export function igniteAuthorStyle(css) {
	if (typeof css !== "string") {
		throw new TypeError("igniteAuthorStyle expects a string");
	}
	return Object.freeze({ [AUTHOR]: css });
}

export function readAuthorStyle(value) {
	if (!value || typeof value !== "object") return undefined;
	if (!Object.hasOwn(value, AUTHOR)) return undefined;
	const css = value[AUTHOR];
	return typeof css === "string" ? css : undefined;
}

export function renderC(view) {
	const styleAttribute = filterStyleAttribute(view.style, loaderBlocked);
	const styleElement = styleElementText(view.styleChildren);
	const committed = commitProps(view.props);
	return { styleAttribute, styleElement, warnings: [], ...committed };
}

function styleElementText(children) {
	const parts = Array.isArray(children) ? children : [children];
	let authored = true;
	let any = false;
	let full = "";
	for (const part of parts) {
		if (part == null || part === false) continue;
		const author = readAuthorStyle(part);
		if (author !== undefined) {
			any = true;
			full += author;
			continue;
		}
		if (typeof part === "string") {
			authored = false;
			any = true;
			full += part;
			continue;
		}
		authored = false;
	}
	if (!any) return "";
	if (authored) return filterSheet(full, scriptableBlocked).css;
	return filterSheet(full, loaderBlocked).css;
}
