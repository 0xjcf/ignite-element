export type NavigationHistoryMode = "push" | "replace";

export type NavigationPort = {
	currentPath(): string;
	observe(listener: (path: string) => void): () => void;
	commit(path: string, history: NavigationHistoryMode): Promise<void>;
};

export type MemoryNavigation = NavigationPort & {
	readonly commitCalls: Array<{
		path: string;
		history: NavigationHistoryMode;
	}>;
	externalNavigate(path: string): void;
	observerCount(): number;
	rejectNextCommit(error: unknown): void;
};

type BrowserNavigationResult =
	| {
			committed?: Promise<unknown>;
			finished?: Promise<unknown>;
	  }
	| void;

type BrowserNavigationEvent = Event & {
	canIntercept?: boolean;
	hashChange?: boolean;
	downloadRequest?: string | null;
	destination?: { url?: string };
	intercept?: (options?: { handler?: () => Promise<void> | void }) => void;
};

type BrowserNavigation = EventTarget & {
	currentEntry?: { url?: string };
	navigate(
		path: string,
		options?: { history?: NavigationHistoryMode },
	): BrowserNavigationResult;
	addEventListener(
		type: "navigate",
		listener: (event: BrowserNavigationEvent) => void,
	): void;
	removeEventListener(
		type: "navigate",
		listener: (event: BrowserNavigationEvent) => void,
	): void;
};

const toPath = (url: string | undefined): string => {
	if (!url) {
		return "/";
	}

	const parsed = new URL(url, "https://example.test");
	const path = `${parsed.pathname}${parsed.search}`;
	return path === "" ? "/" : path;
};

const sameOrigin = (left: string | undefined, right: string | undefined): boolean => {
	if (!left || !right) {
		return true;
	}

	return new URL(left, "https://example.test").origin ===
		new URL(right, "https://example.test").origin;
};

const isInterceptableNavigation = (
	event: BrowserNavigationEvent,
	currentUrl: string | undefined,
): event is BrowserNavigationEvent & { destination: { url: string } } => {
	const destinationUrl = event.destination?.url;
	return (
		Boolean(destinationUrl) &&
		event.canIntercept !== false &&
		!event.hashChange &&
		!event.downloadRequest &&
		sameOrigin(currentUrl, destinationUrl)
	);
};

export const createBrowserNavigation = (
	navigation: BrowserNavigation,
): NavigationPort => {
	const suppressedPaths = new Map<string, number>();

	const trackSuppressedPath = (path: string) => {
		suppressedPaths.set(path, (suppressedPaths.get(path) ?? 0) + 1);
	};

	const releaseSuppressedPath = (path: string) => {
		const current = suppressedPaths.get(path);
		if (!current) {
			return;
		}

		if (current === 1) {
			suppressedPaths.delete(path);
			return;
		}

		suppressedPaths.set(path, current - 1);
	};

	const consumeSuppressedPath = (path: string): boolean => {
		if (!suppressedPaths.has(path)) {
			return false;
		}

		releaseSuppressedPath(path);
		return true;
	};

	return {
		currentPath: () => toPath(navigation.currentEntry?.url),
		observe(listener) {
			const handleNavigate = (event: BrowserNavigationEvent) => {
				const currentUrl = navigation.currentEntry?.url;
				if (!isInterceptableNavigation(event, currentUrl)) {
					return;
				}

				const path = toPath(event.destination.url);
				const handler = () => {
					if (!consumeSuppressedPath(path)) {
						listener(path);
					}
				};

				if (typeof event.intercept === "function") {
					event.intercept({ handler });
					return;
				}

				handler();
			};

			navigation.addEventListener("navigate", handleNavigate);
			return () => navigation.removeEventListener("navigate", handleNavigate);
		},
		async commit(path, history) {
			trackSuppressedPath(path);
			try {
				const result = navigation.navigate(path, { history });
				await result?.committed ?? result?.finished ?? Promise.resolve();
			} finally {
				releaseSuppressedPath(path);
			}
		},
	};
};

export const createMemoryNavigation = (initialPath: string): MemoryNavigation => {
	let currentPath = initialPath;
	let nextCommitError: unknown;
	const listeners = new Set<(path: string) => void>();
	const commitCalls: Array<{
		path: string;
		history: NavigationHistoryMode;
	}> = [];

	return {
		commitCalls,
		currentPath: () => currentPath,
		observe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async commit(path, history) {
			commitCalls.push({ path, history });
			if (typeof nextCommitError !== "undefined") {
				const error = nextCommitError;
				nextCommitError = undefined;
				throw error;
			}

			currentPath = path;
		},
		externalNavigate(path) {
			currentPath = path;
			for (const listener of listeners) {
				listener(path);
			}
		},
		observerCount: () => listeners.size,
		rejectNextCommit(error) {
			nextCommitError = error;
		},
	};
};
