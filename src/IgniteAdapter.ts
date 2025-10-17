export default interface IgniteAdapter<State, Event> {
	/**
	 * Subscribes to state changes and returns an unsubscribe function
	 */
	subscribe: (listener: (state: State) => void) => { unsubscribe: () => void };

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
}
