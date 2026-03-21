import type { EnhancedStore, Slice } from "@reduxjs/toolkit";

export function isReduxStore(source: unknown): source is EnhancedStore {
	if (typeof source !== "object" || source === null) {
		return false;
	}

	const candidate = source as Partial<EnhancedStore> & {
		getState?: unknown;
		dispatch?: unknown;
		subscribe?: unknown;
	};

	return (
		typeof candidate.getState === "function" &&
		typeof candidate.dispatch === "function" &&
		typeof candidate.subscribe === "function"
	);
}

export function isReduxSlice(source: unknown): source is Slice {
	if (typeof source !== "object" || source === null) {
		return false;
	}

	const candidate = source as Partial<Slice> & {
		name?: unknown;
		reducer?: unknown;
		actions?: unknown;
		getInitialState?: unknown;
	};

	return (
		typeof candidate.name === "string" &&
		typeof candidate.reducer === "function" &&
		candidate.actions !== undefined &&
		typeof candidate.actions === "object" &&
		candidate.actions !== null &&
		typeof candidate.getInitialState === "function"
	);
}
