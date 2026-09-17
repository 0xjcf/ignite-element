import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as igniteRedux } from "ignite-element/redux";
import { expect } from "vitest";

const counterSlice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		add: (state, action: { payload: number }) => {
			state.count += action.payload;
		},
		decrement: (state) => {
			state.count -= 1;
		},
	},
});
const store = configureStore({ reducer: { counter: counterSlice.reducer } });
const recoveryCounter = igniteRedux({
	source: store,
	states: (snapshot) => ({
		count: snapshot.counter.count,
		canDecrement: snapshot.counter.count > 0,
	}),
	commands: ({ source: actor }) => ({
		increment: (amount: number) =>
			actor.dispatch(counterSlice.actions.add(amount)),
		decrement: () => actor.dispatch(counterSlice.actions.decrement()),
	}),
	events: (event) => ({ "counter-incremented": event<{ count: number }>() }),
	effects: ({ snapshot, prevSnapshot, emit }) => {
		if (snapshot.counter.count !== prevSnapshot.counter.count) {
			emit({ type: "counter-incremented", count: snapshot.counter.count });
		}
	},
});

expect(store.getState().counter.count).toBe(0);
expect(recoveryCounter.get("states").canDecrement).toBe(false);
const result = await recoveryCounter.execute({
	command: "increment",
	input: 2,
});
const countedEvent: Awaited<
	ReturnType<typeof recoveryCounter.execute>
>["events"][number] = { type: "counter-incremented", count: 2 };
expect(result.snapshot.counter.count).toBe(2);
expect(result.states).toEqual({ count: 2, canDecrement: true });
expect(result.events).toEqual([countedEvent]);
expect(recoveryCounter.get("states").canDecrement).toBe(true);
const observed: number[] = [];
const subscription = recoveryCounter.watch((states) =>
	observed.push(states.count),
);
try {
	store.dispatch(counterSlice.actions.add(1));
	expect(store.getState().counter.count).toBe(3);
	expect(recoveryCounter.get("states").count).toBe(3);
	expect(observed).toContain(3);
	await recoveryCounter.execute({ command: "decrement" });
	expect(store.getState().counter.count).toBe(2);
} finally {
	subscription.unsubscribe();
	recoveryCounter.dispose();
}
