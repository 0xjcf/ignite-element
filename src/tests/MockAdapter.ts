import { vi } from "vitest";
import IgniteAdapter from "../IgniteAdapter";

// Minimal Mock Adapter implementation
class MockAdapter<State, Event> implements IgniteAdapter<State, Event> {
  private mockState: State;

  constructor(initialState: State) {
    this.mockState = initialState;
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
