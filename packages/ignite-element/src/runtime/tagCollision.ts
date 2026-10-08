type TagDefinition = {
	owner: object;
	definition: object;
};

const definitions = new Map<string, TagDefinition>();
const warned = new Set<string>();

function isDevelopment(): boolean {
	try {
		return process.env.NODE_ENV !== "production";
	} catch {
		return true;
	}
}

/**
 * Development-only. `record` stores the definition that just registered.
 * `existing` warns once when a different definition asks for that tag.
 */
export function noteTagDefinition(
	tag: string,
	owner: object,
	definition: object,
	mode: "record" | "existing",
): void {
	if (!isDevelopment()) return;
	const previous = definitions.get(tag);
	if (mode === "record") {
		if (previous === undefined) definitions.set(tag, { owner, definition });
		return;
	}
	if (
		previous !== undefined &&
		previous.owner === owner &&
		previous.definition === definition
	) {
		return;
	}
	if (warned.has(tag)) return;
	warned.add(tag);
	try {
		console.warn(
			`[igniteCore] Custom element "${tag}" is already defined by a different component. The existing registration was kept.`,
		);
	} catch {
		/* A user-installed console must not change registration. */
	}
}
