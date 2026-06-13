export enum StateScope {
	Shared = "shared",
	Isolated = "isolated",
}

export default interface IgniteAdapter<State, Event, Emitted = never> {
	/**
	 * Subscribes to snapshot (state) changes and returns an unsubscribe function.
	 * Named for the public `igniteCore` snapshot vocabulary; adapters may still
	 * call their source's native subscription (e.g. `store.subscribe`,
	 * `actor.subscribe`) internally.
	 */
	subscribeSnapshots: (listener: (state: State) => void) => {
		unsubscribe: () => void;
	};

	/**
	 * Optional subscription to source-emitted domain events — a side-channel
	 * distinct from snapshot changes (e.g. an actor's emitted events, a
	 * WebSocket/SSE push). Adapters that have such a channel implement this;
	 * others omit it. The headless runtime bridges it into `on(...)` /
	 * `execute().events` when present. Returns an unsubscribe handle matching
	 * `subscribeSnapshots`.
	 */
	subscribeEvents?: (listener: (event: Emitted) => void) => {
		unsubscribe: () => void;
	};

	/**
	 * Sends an event or action to update the state
	 */
	send: (event: Event) => void;

	/**
	 * Retrieves the current snapshot (state). Named for the public `igniteCore`
	 * snapshot vocabulary; adapters may still call their source's native reader
	 * (e.g. `store.getState`, `actor.getSnapshot`) internally.
	 */
	getSnapshot: () => State;

	/**
	 * Stops the adapter, cleaning up resources
	 */
	stop: () => void;

	/**
	 * Indicates whether the adapter is shared or isolated.
	 */
	scope?: StateScope;
}
