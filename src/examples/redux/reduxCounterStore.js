import { configureStore, createSlice } from "@reduxjs/toolkit";
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
const counterStore = () => configureStore({
    reducer: counterSlice.reducer,
});
export default counterStore;
