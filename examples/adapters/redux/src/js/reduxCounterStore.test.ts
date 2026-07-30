import { describe, expect, it, vi } from "vitest";
import counterStore, { counterSlice } from "./reduxCounterStore";

const { increment, decrement, addByAmount } = counterSlice.actions;

describe("reduxCounterStore", () => {
	it("starts at zero", () => {
		expect(counterStore().getState().counter.count).toBe(0);
	});

	it("increments, decrements, and adds by amount", () => {
		const store = counterStore();
		store.dispatch(increment());
		store.dispatch(increment());
		expect(store.getState().counter.count).toBe(2);

		store.dispatch(decrement());
		expect(store.getState().counter.count).toBe(1);

		store.dispatch(addByAmount(5));
		expect(store.getState().counter.count).toBe(6);
	});

	it("isolates state across store instances", () => {
		const a = counterStore();
		const b = counterStore();
		a.dispatch(increment());
		expect(a.getState().counter.count).toBe(1);
		expect(b.getState().counter.count).toBe(0);
	});

	it("hydrates from injected persistence and leaves native cleanup with Redux ownership", () => {
		const nativeCleanup = vi.fn();
		const persistence = {
			load: vi.fn(() => 4),
			observe: vi.fn((listener: (count: number) => void) => {
				listener(4);
				return nativeCleanup;
			}),
			save: vi.fn(),
		};
		const createStore = counterStore as unknown as (options: {
			persistence: typeof persistence;
		}) => {
			dispatch: (action: ReturnType<typeof addByAmount>) => void;
			getState: () => { counter: { count: number } };
			dispose: () => void;
		};

		const store = createStore({ persistence });

		expect(persistence.load).toHaveBeenCalledTimes(1);
		expect(store.getState().counter.count).toBe(4);

		store.dispatch(addByAmount(3));
		expect(persistence.save).toHaveBeenLastCalledWith(7);

		store.dispose();
		store.dispose();
		expect(nativeCleanup).toHaveBeenCalledTimes(1);
	});

	it("does not echo persistence notifications back into an infinite save loop", () => {
		const listeners = new Set<(count: number) => void>();
		const persistence = {
			load: vi.fn(() => 1),
			observe: vi.fn((listener: (count: number) => void) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			}),
			save: vi.fn((count: number) => {
				for (const listener of listeners) {
					listener(count);
				}
			}),
		};
		const createStore = counterStore as unknown as (options: {
			persistence: typeof persistence;
		}) => {
			dispatch: (action: ReturnType<typeof addByAmount>) => void;
			getState: () => { counter: { count: number } };
		};

		const store = createStore({ persistence });

		store.dispatch(addByAmount(2));
		expect(store.getState().counter.count).toBe(3);
		expect(persistence.save).toHaveBeenCalledTimes(1);
		expect(persistence.save).toHaveBeenLastCalledWith(3);
	});
});
