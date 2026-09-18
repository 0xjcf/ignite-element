import {
	useInsertionEffect,
	useLayoutEffect,
	useMemo,
	useSyncExternalStore,
} from "react";
import { acquireBindingStore } from "../runtime/bindings";

/** Definitions/factories own a private runtime; existing sources remain shared. */
export function useIgnite<Values extends Record<string, unknown>>(core: {
	readonly __igniteRenderArgs?: Values;
}): Readonly<Values> {
	const store = useMemo(() => acquireBindingStore(core), [core]);
	// Record retention before descendant layout effects/refs, without activating
	// sources or scheduling React updates in the insertion phase. Activity hides
	// disconnect layout/passive effects while retaining this ownership record.
	useInsertionEffect(() => store.attach?.(), [store]);
	// Visible subscriptions start observation; commands can also activate it once
	// attached, including from descendants before this layout effect.
	useLayoutEffect(() => store.commit?.(), [store]);
	// No server snapshot: SSR is not part of this binding's contract.
	return useSyncExternalStore(store.subscribe, store.read) as Readonly<Values>;
}
