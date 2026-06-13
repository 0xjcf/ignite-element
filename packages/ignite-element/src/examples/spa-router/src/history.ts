// The imperative shell: the ONLY module that touches `window.history` and
// `location`. The router machine stays a pure functional core; this bridges it
// to the browser. Reads come in as POPSTATE events; writes happen here when the
// component's effect commits a navigation.

/** The current pathname (the machine only cares about the path, not origin). */
export const currentPath = (): string => window.location.pathname;

/** Push a new history entry. No-op when the URL already matches (e.g. redirects). */
export const pushPath = (path: string): void => {
	if (path !== window.location.pathname) {
		window.history.pushState(null, "", path);
	}
};

/**
 * Subscribe to browser back/forward. Returns an unsubscribe function. The
 * handler receives the new pathname; the caller feeds it back into the machine
 * as a POPSTATE event (which must NOT push — the browser already moved the URL).
 */
export const onPopState = (handler: (path: string) => void): (() => void) => {
	const listener = () => handler(window.location.pathname);
	window.addEventListener("popstate", listener);
	return () => window.removeEventListener("popstate", listener);
};
