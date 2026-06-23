// Test fixture: a minimal Redux Toolkit counter store used by the library's
// adapter/runtime/test-DSL suites. Previously these suites imported this from
// the redux example app; the fixture now lives with the tests so the library
// test suite does not depend on example source (examples live in top-level
// `examples/`). Kept byte-identical to the example's store so behavior is stable.
import type { PayloadAction } from "@reduxjs/toolkit";
import { configureStore, createSlice } from "@reduxjs/toolkit";

export interface CounterState {
	count: number;
}

const initialState: CounterState = {
	count: 0,
};

export const counterSlice = createSlice({
	name: "counter",
	initialState,
	reducers: {
		increment: (state) => {
			state.count++;
		},
		decrement: (state) => {
			state.count--;
		},
		addByAmount: (state, action: PayloadAction<number>) => {
			state.count += action.payload;
		},
	},
});

export const counterStore = () =>
	configureStore({
		reducer: {
			counter: counterSlice.reducer,
		},
	});

export default counterStore;

export const { increment, decrement, addByAmount } = counterSlice.actions;
