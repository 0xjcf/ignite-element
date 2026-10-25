const AUTHOR_STYLE = Symbol("ignite-element.authorStyle");
const authorSeen = new WeakSet<object>();
// Captured at load. A later overwrite of these methods cannot mint trust.
const seenHas = WeakSet.prototype.has;
const seenAdd = WeakSet.prototype.add;

export interface AuthorStyle {
	readonly [AUTHOR_STYLE]: string;
}

export function readAuthorStyle(value: unknown): string | undefined {
	// Membership before any property read, so a throwing proxy is dropped.
	// Non-objects throw inside WeakSet.has and land in the same drop.
	try {
		if (!seenHas.call(authorSeen, value as object)) return undefined;
		const css = (value as Record<symbol, unknown>)[AUTHOR_STYLE];
		return typeof css === "string" ? css : undefined;
	} catch {
		return undefined;
	}
}

export function igniteAuthorStyle(css: string): AuthorStyle {
	if (typeof css !== "string") {
		throw new TypeError("igniteAuthorStyle expects a string");
	}
	const branded: AuthorStyle = Object.freeze({
		[AUTHOR_STYLE]: css,
	});
	seenAdd.call(authorSeen, branded);
	return branded;
}
