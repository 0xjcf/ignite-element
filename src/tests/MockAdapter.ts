import { vi } from "vitest";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";

// Minimal Mock Adapter implementation
class MockAdapter<State, Event> implements IgniteAdapter<State, Event> {
	private mockState: State;
	public scope: StateScope | undefined;
	public unsubscribe = vi.fn();

	constructor(initialState: State, scope: StateScope = StateScope.Isolated) {
		this.mockState = initialState;
		this.scope = scope;
	}

	subscribe = vi.fn((listener: (state: State) => void) => {
		listener(this.mockState);
		const unsubscribe = this.unsubscribe;
		return {
			unsubscribe,
		};
	});

	send = vi.fn();

	getState = vi.fn(() => this.mockState);

	stop = vi.fn();
}

export default MockAdapter;
