import type { Mock } from "vitest";
import { vi } from "vitest";
import type { IgniteAdapter } from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";

// Minimal Mock Adapter implementation
class MockAdapter<State, Event> implements IgniteAdapter<State, Event> {
	private mockState: State;
	public scope: StateScope | undefined;
	public unsubscribe: Mock<() => void> = vi.fn();

	constructor(initialState: State, scope: StateScope = StateScope.Isolated) {
		this.mockState = initialState;
		this.scope = scope;
	}

	subscribe: Mock<
		(listener: (state: State) => void) => { unsubscribe: () => void }
	> = vi.fn((listener: (state: State) => void) => {
		listener(this.mockState);
		const unsubscribe = this.unsubscribe;
		return {
			unsubscribe,
		};
	});

	send: Mock<(event: Event) => void> = vi.fn();

	getState: Mock<() => State> = vi.fn(() => this.mockState);

	stop: Mock<() => void> = vi.fn();
}

export default MockAdapter;
