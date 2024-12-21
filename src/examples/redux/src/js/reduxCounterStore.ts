import { createSlice, configureStore, PayloadAction } from "@reduxjs/toolkit";

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

const counterStore = () =>
  configureStore({
    reducer: {
      counter: counterReducer,
    },
  });

export default counterStore;

export const { increment, decrement, addByAmount } = counterSlice.actions;
