import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";

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
    addBy(state, action: PayloadAction<number>) {
      state.count += action.payload;
    },
  },
});

export const { increment, decrement, addBy } = counterSlice.actions;

// Function to create a new Redux store
export default function configureCounterStore() {
  return configureStore({
    reducer: counterSlice.reducer,
  });
}
