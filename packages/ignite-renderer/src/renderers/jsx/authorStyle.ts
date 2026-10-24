const AUTHOR_STYLE = Symbol("ignite-element.authorStyle");
const authorSeen = new WeakSet<object>();

export interface AuthorStyle {
	readonly [AUTHOR_STYLE]: string;
}

export interface IgniteAuthorStyle {
	(css: string): AuthorStyle;
	/** Same-module reader. Not a package export. */
	readonly read: (value: unknown) => string | undefined;
}

function readAuthorStyle(value: unknown): string | undefined {
	// Membership before any property read, so a throwing proxy is dropped.
	// Non-objects throw inside WeakSet.has and land in the same drop.
	try {
		if (!authorSeen.has(value as object)) return undefined;
		const css = (value as Record<symbol, unknown>)[AUTHOR_STYLE];
		return typeof css === "string" ? css : undefined;
	} catch {
		return undefined;
	}
}

function markAuthorStyle(css: string): AuthorStyle {
	if (typeof css !== "string") {
		throw new TypeError("igniteAuthorStyle expects a string");
	}
	const branded: AuthorStyle = Object.freeze({
		[AUTHOR_STYLE]: css,
	});
	authorSeen.add(branded);
	return branded;
}

export const igniteAuthorStyle: IgniteAuthorStyle = Object.assign(
	markAuthorStyle,
	{ read: readAuthorStyle },
);
