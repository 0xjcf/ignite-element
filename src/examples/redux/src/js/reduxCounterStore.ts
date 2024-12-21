import { createSlice, configureStore } from "@reduxjs/toolkit";
import type { InferStateAndEvent } from "../../../../utils/igniteRedux";

interface CounterState {
  count: number;
}

const initialState: CounterState = {
  count: 0,
};

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.count++;
    },
    decrement: (state) => {
      state.count--;
    },
    addByAmount: (state, action) => {
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

/**
 * Optional for testing components easily
 */
type IgniteRedux = InferStateAndEvent<
  typeof counterStore,
  typeof counterSlice.actions
>;

export type State = IgniteRedux["State"];
export type Event = IgniteRedux["Event"];
