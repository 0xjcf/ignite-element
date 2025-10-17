import { vi } from "vitest";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";

// Minimal Mock Adapter implementation
class MockAdapter<State, Event> implements IgniteAdapter<State, Event> {
	private mockState: State;
	public scope: StateScope | undefined;

	constructor(initialState: State, scope: StateScope = StateScope.Isolated) {
		this.mockState = initialState;
		this.scope = scope;
	}

	subscribe = vi.fn((listener: (state: State) => void) => {
		listener(this.mockState);
		return { unsubscribe: vi.fn() };
	});

	send = vi.fn();

	getState = vi.fn(() => this.mockState);

	stop = vi.fn();
}

export default MockAdapter;
