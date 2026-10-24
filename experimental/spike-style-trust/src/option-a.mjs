import {
	commitProps,
	filterSheet,
	filterStyleAttribute,
	scriptableBlocked,
} from "./policy.mjs";

/**
 * React-style. No CSS loader filtering. expression(, behavior, -moz-binding,
 * and a style breakout (`</` or `<!`) are still dropped. URL attributes
 * stay on the internal allowlist.
 */
export function renderA(view) {
	const styleAttribute = filterStyleAttribute(view.style, scriptableBlocked, {
		paren: false,
	});
	const joined = joinChildren(view.styleChildren);
	const styleElement = filterSheet(joined, scriptableBlocked).css;
	const committed = commitProps(view.props);
	return { styleAttribute, styleElement, warnings: [], ...committed };
}

function joinChildren(children) {
	if (typeof children === "string") return children;
	if (!Array.isArray(children)) return "";
	return children.map((part) => (typeof part === "string" ? part : "")).join("");
}
