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
			currentPath = path;
			if (typeof nextCommitError !== "undefined") {
				const error = nextCommitError;
				nextCommitError = undefined;
				throw error;
			}
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
