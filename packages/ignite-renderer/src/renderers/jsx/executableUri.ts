// Shared with projection documents. The renderer rejects these schemes on
// URL attributes; projection documents reject them in model-readable data.

export const uriBearingKeyPattern =
	/^(?:href|src|action|formaction|xlink:href)$/i;
export const executableUriPattern =
	/^(?:java|vb)script:|^data:(?:text\/html|image\/svg\+xml|application\/xhtml\+xml)(?:;|,|$)/;
// ASCII space and the controls at or below it, plus DEL. Obfuscated
// schemes hide themselves in those characters.
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-character class
export const uriSpacePattern = /[\u0000-\u0020\u007f]/g;
const uriArrayScalarBlocker = "#";

export function isUriBearingKey(key: string): boolean {
	return uriBearingKeyPattern.test(key);
}

export function isExecutableUri(value: string): boolean {
	uriSpacePattern.lastIndex = 0;
	return executableUriPattern.test(
		value.replace(uriSpacePattern, "").toLowerCase(),
	);
}

function createUriArrayCandidate(value: unknown[]): string {
	let candidate = "";
	for (let index = 0; index < value.length; index += 1) {
		if (index > 0) {
			candidate += ",";
		}

		const entry: unknown = value[index];
		if (entry === null) {
			continue;
		}
		if (typeof entry === "string") {
			candidate += entry;
			continue;
		}
		if (Array.isArray(entry)) {
			candidate += createUriArrayCandidate(entry);
			continue;
		}

		candidate += uriArrayScalarBlocker;
	}
	return candidate;
}

export function containsExecutableUri(value: unknown): boolean {
	if (typeof value === "string") {
		return isExecutableUri(value);
	}
	return (
		Array.isArray(value) && isExecutableUri(createUriArrayCandidate(value))
	);
}
