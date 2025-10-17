import type { EnhancedStore } from "@reduxjs/toolkit";
import { isObservable } from "mobx";

export interface XStateActorLike {
	start?: () => unknown;
	stop?: () => unknown;
	send: (...args: unknown[]) => unknown;
	subscribe: (...args: unknown[]) => unknown;
	getSnapshot: () => unknown;
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

export function isMobxObservable(source: unknown): boolean {
	if (typeof source !== "object" || source === null) {
		return false;
	}

	if (isObservable(source)) {
		return true;
	}

	// biome-ignore lint/suspicious/noPrototypeBuiltins: supporting older JS targets without Object.hasOwn
	if (Object.prototype.hasOwnProperty.call(source, "$$observable")) {
		return true;
	}
	// biome-ignore lint/suspicious/noPrototypeBuiltins: supporting older JS targets without Object.hasOwn
	if (Object.prototype.hasOwnProperty.call(source, "_atom")) {
		return true;
	}
	// biome-ignore lint/suspicious/noPrototypeBuiltins: supporting older JS targets without Object.hasOwn
	if (Object.prototype.hasOwnProperty.call(source, "$mobx")) {
		return true;
	}

	return false;
}

export function isFunction<T extends (...args: unknown[]) => unknown>(
	value: unknown,
): value is T {
	return typeof value === "function";
}
