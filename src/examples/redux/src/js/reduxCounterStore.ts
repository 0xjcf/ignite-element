import { configureStore, createSlice } from "@reduxjs/toolkit";

type CounterState = { count: number };
type CounterEvent =
  | { type: "counter/increment" }
  | { type: "counter/decrement" };

const counterSlice = createSlice({
  name: "counter",
  initialState: {
    count: 0,
  },
  reducers: {
    increment(state) {
      state.count += 1;
    },
    decrement(state) {
      state.count -= 1;
    },
  },
});

export const { increment, decrement } = counterSlice.actions;

const counterStore = () =>
  configureStore<CounterState, CounterEvent>({
    reducer: counterSlice.reducer,
  });

export default counterStore;
