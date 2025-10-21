import type { PayloadAction } from "@reduxjs/toolkit";
import { configureStore, createSlice } from "@reduxjs/toolkit";

interface CounterState {
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

const counterReducer = counterSlice.reducer;

const createCounterStore = () =>
	configureStore({
		reducer: {
			counter: counterReducer,
		},
	});

type BaseCounterStore = ReturnType<typeof createCounterStore>;
type CounterActions = typeof counterSlice.actions;

type StoreWithIgniteMetadata = BaseCounterStore & {
	__igniteActions: CounterActions;
};

const counterStore = (): StoreWithIgniteMetadata => {
	const store = createCounterStore();
	const withMetadata = store as StoreWithIgniteMetadata;
	withMetadata.__igniteActions = counterSlice.actions;
	return withMetadata;
};

export default counterStore;

export const { increment, decrement, addByAmount } = counterSlice.actions;
