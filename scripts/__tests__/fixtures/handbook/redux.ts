import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore } from "ignite-element/redux";

const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		increment: (state) => {
			state.count += 1;
		},
	},
});
export const source = configureStore({ reducer: slice.reducer });
export const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.count }),
	commands: ({ actor }) => ({
		increment: () => actor.dispatch(slice.actions.increment()),
	}),
});
