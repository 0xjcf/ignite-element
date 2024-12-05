import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CounterState {
  count: number;
}

export const counterSlice = createSlice({
  name: "counter",
  initialState: {
    count: 0,
  } as CounterState,
  reducers: {
    increment(state) {
      state.count += 1;
    },
    decrement(state) {
      state.count -= 1;
    },
    addByAmount(state, action: PayloadAction<number>) {
      state.count += action.payload;
    },
  },
});

export const { increment, decrement, addByAmount } = counterSlice.actions;

const counterStore = () =>
  configureStore({
    reducer: counterSlice.reducer,
  });

export default counterStore;
