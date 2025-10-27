import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";

export interface XStateActorLike {
	start?: () => unknown;
	stop?: () => unknown;
	send: (...args: unknown[]) => unknown;
	subscribe: (...args: unknown[]) => unknown;
	getSnapshot: () => unknown;
}

export function isXStateMachine(source: unknown): source is AnyStateMachine {
	if (typeof source !== "object" || source === null) {
		return false;
	}

	const machine = source as Partial<AnyStateMachine> & {
		transition?: unknown;
		getInitialSnapshot?: unknown;
	};

	return (
		typeof machine.transition === "function" &&
		typeof machine.getInitialSnapshot === "function"
	);
}

export function isXStateActor(source: unknown): source is XStateActorLike {
	if (typeof source !== "object" || source === null) {
		return false;
	}

	const actor = source as XStateActorLike;
	return (
		typeof actor.send === "function" &&
		typeof actor.subscribe === "function" &&
		typeof actor.getSnapshot === "function" &&
		(typeof actor.start === "function" || typeof actor.stop === "function")
	);
}

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

export function isFunction<T extends (...args: unknown[]) => unknown>(
	value: unknown,
): value is T {
	return typeof value === "function";
}
