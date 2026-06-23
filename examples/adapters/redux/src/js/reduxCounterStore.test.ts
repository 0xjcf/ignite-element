import { describe, expect, it } from "vitest";
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
});
