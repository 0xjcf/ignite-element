import { useMemo, useSyncExternalStore } from "react";
import { requireBindingStore } from "../runtime/bindings";

/** Borrow a prepared core; only this component's subscription is released. */
export function useIgnite<Values extends Record<string, unknown>>(core: {
	readonly __igniteRenderArgs?: Values;
}): Readonly<Values> {
	const store = useMemo(() => requireBindingStore(core), [core]);
	// No server snapshot: SSR is not part of this binding's contract.
	return useSyncExternalStore(store.subscribe, store.read) as Readonly<Values>;
}
