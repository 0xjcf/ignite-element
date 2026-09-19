import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as actorWeb } from "ignite-element/actor-web";
import { igniteCore as actorWebHost } from "ignite-element/actor-web/web";
import { igniteCore as mobx } from "ignite-element/mobx";
import { igniteCore as redux } from "ignite-element/redux";
import { igniteCore as xstate } from "ignite-element/xstate";
import { makeAutoObservable } from "mobx";
import { createMachine } from "xstate";

const machine = createMachine({});
const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		increment(state) {
			state.count++;
		},
	},
});
const store = configureStore({ reducer: slice.reducer });
const source = {
	address: "counter",
	send: async () => {},
	close: () => {},
	transportStatus: () => ({ state: "disconnected" as const, updatedAt: 0 }),
	snapshot: () => ({
		address: "counter",
		context: {},
		phase: "active",
		toJSON: () => ({}),
	}),
	subscribe: () => () => {},
};

actorWeb({ source });
actorWebHost({ source: () => source });

for (const cleanup of [true, false, undefined]) {
	// @ts-expect-error cleanup is removed even when explicitly undefined
	xstate({ source: machine, cleanup });
	// @ts-expect-error cleanup is removed from slice configuration
	redux({ source: slice, cleanup });
	// @ts-expect-error cleanup is removed from store configuration
	redux({ source: store, cleanup });
	// @ts-expect-error cleanup is removed from factory configuration
	redux({ source: () => store, cleanup });
	// @ts-expect-error cleanup is removed from observable configuration
	mobx({ source: makeAutoObservable({ count: 0 }), cleanup });
	// @ts-expect-error cleanup is removed from factory configuration
	mobx({ source: () => makeAutoObservable({ count: 0 }), cleanup });
	// @ts-expect-error cleanup is removed from neutral Actor-Web configuration
	actorWeb({ source, cleanup });
	// @ts-expect-error cleanup is removed from host-owned Actor-Web configuration
	actorWebHost({ source: () => source, cleanup });
}
const core = redux({
	source: store,
	states: (s) => ({ count: s.count }),
	commands: ({ source: store }) => ({
		increment: () => store.dispatch(slice.actions.increment()),
	}),
});
const count: number = core.get("states").count;
void count;
core.execute({ command: "increment" });
// @ts-expect-error command inference remains exact
core.execute({ command: "missing" });
