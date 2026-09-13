import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore } from "ignite-element/redux";

const slice = createSlice({
	name: "count",
	initialState: { count: 0 },
	reducers: {
		add: (state, action: { payload: number }) => {
			state.count += action.payload;
		},
	},
});
const source = configureStore({ reducer: slice.reducer });
const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.count }),
	commands: ({ actor }) => ({
		add: (amount: number) => actor.dispatch(slice.actions.add(amount)),
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
// @ts-expect-error Inferable state-command collision.
igniteCore({
	source,
	states: (snapshot) => ({ add: snapshot.count }),
	commands: () => ({ add: () => 1 }),
});

const count: number = core.get("states").count;
core.watch((next, previous) => {
	const delta: number = next.count - previous.count;
	void delta;
});
core.on("changed", (fact) => {
	const value: number = fact.count;
	void value;
});
core.execute({ command: "add", input: 2 });
// @ts-expect-error Invalid command input.
core.execute({ command: "add", input: "bad" });
// @ts-expect-error Invalid outward event.
core.on("missing", () => {});
// @ts-expect-error No zero-argument read.
core.get();
// @ts-expect-error No raw snapshot read key.
core.get("snapshot");
// @ts-expect-error Removed public getter.
core.getStates();
// @ts-expect-error Removed public schema getter.
core.getSchema();
// @ts-expect-error Removed helper-dependent query.
core.canExecute("add");
// @ts-expect-error Removed public raw observation.
core.watchSnapshot(() => {});
void count;
core.dispose();
