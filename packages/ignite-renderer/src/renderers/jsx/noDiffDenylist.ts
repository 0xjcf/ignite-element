const noDiffDenylist = new Set<string>();

export function registerNoDiffDenylistTag(tagName: string): void {
	noDiffDenylist.add(tagName.toLowerCase());
}

export function clearNoDiffDenylistForTests(): void {
	noDiffDenylist.clear();
}

export function isNoDiffDenylistedTag(
	tagName: string | null | undefined,
): boolean {
	if (!tagName) return false;
	return noDiffDenylist.has(tagName.toLowerCase());
}

export { noDiffDenylist };
