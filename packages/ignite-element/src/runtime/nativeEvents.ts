import type { IgniteAdapter } from "@ignite-element/core";
import type { Lifetime } from "./lifetime";

/** Subscribe only to the acquired element adapter; never acquire a runtime. */
export function forwardNativeEvents<State, Event>(
	adapter: IgniteAdapter<State, Event>,
	host: EventTarget,
	names: readonly string[],
	observe: (name: string) => void,
	lifetime: Pick<Lifetime, "active">,
): () => void {
	if (!names.length || !adapter.subscribeEvents) return () => {};
	let active = true;
	let subscription: { unsubscribe(): void } | undefined;
	try {
		subscription = adapter.subscribeEvents((event: unknown) => {
			if (
				!active ||
				!lifetime.active ||
				typeof event !== "object" ||
				event === null ||
				!("type" in event) ||
				typeof event.type !== "string"
			)
				return;
			observe(event.type);
			if (!names.includes(event.type)) return;
			const { type, ...detail } = event;
			// External observation or payload access can dispose reentrantly, even
			// before subscribeEvents returns a handle that we can release.
			if (!active || !lifetime.active) return;
			host.dispatchEvent(
				new CustomEvent(type, { detail, bubbles: true, composed: true }),
			);
		});
	} catch (error) {
		active = false;
		throw error;
	}
	return () => {
		if (!active) return;
		active = false;
		subscription?.unsubscribe();
	};
}
