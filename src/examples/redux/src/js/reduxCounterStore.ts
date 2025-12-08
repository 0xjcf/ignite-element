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
