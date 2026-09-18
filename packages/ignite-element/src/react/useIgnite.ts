import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { acquireBindingStore } from "../runtime/bindings";

/** Definitions/factories own a private runtime; existing sources remain shared. */
export function useIgnite<Values extends Record<string, unknown>>(core: {
	readonly __igniteRenderArgs?: Values;
}): Readonly<Values> {
	const store = useMemo(() => acquireBindingStore(core), [core]);
	// Activate private sources before consumer layout effects can issue commands.
	useLayoutEffect(() => store.commit?.(), [store]);
	// No server snapshot: SSR is not part of this binding's contract.
	return useSyncExternalStore(store.subscribe, store.read) as Readonly<Values>;
}
