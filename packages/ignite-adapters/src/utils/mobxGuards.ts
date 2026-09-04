import { isObservable } from "mobx";

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
