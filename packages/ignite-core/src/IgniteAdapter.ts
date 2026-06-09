export enum StateScope {
	Shared = "shared",
	Isolated = "isolated",
}

export default interface IgniteAdapter<State, Event, Emitted = never> {
	/**
	 * Subscribes to state changes and returns an unsubscribe function
	 */
	subscribe: (listener: (state: State) => void) => { unsubscribe: () => void };

	/**
	 * Optional stream of emitted domain events — a source side-channel distinct
	 * from state changes (e.g. an actor's emitted events, a WebSocket/SSE push).
	 * Adapters that have such a stream implement this; others omit it. The
	 * headless runtime bridges it into `on(...)` / `execute().events` when present.
	 * Returns an unsubscribe handle matching `subscribe`.
	 */
	stream?: (listener: (event: Emitted) => void) => { unsubscribe: () => void };

	/**
	 * Sends an event or action to update the state
	 */
	send: (event: Event) => void;

	/**
	 * Retrieves the current state
	 */
	getState: () => State;

	/**
	 * Stops the adapter, cleaning up resources
	 */
	stop: () => void;

	/**
	 * Indicates whether the adapter is shared or isolated.
	 */
	scope?: StateScope;
}
