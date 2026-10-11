type UnsupportedJsxContentKey =
	| "innerHTML"
	| "outerHTML"
	| "innerText"
	| "outerText"
	| "textContent";

/** Keep a runtime prop object that the public JSX types reject. */
export function unsupportedJsxProps<T extends object>(
	props: T,
): Omit<T, UnsupportedJsxContentKey> {
	return props as Omit<T, UnsupportedJsxContentKey>;
}
