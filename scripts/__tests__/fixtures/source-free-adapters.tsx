import type { ActorWebCommandSource } from "@ignite-element/adapters/actor-web";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as igniteActorWeb } from "ignite-element/actor-web";
import { igniteCore as igniteActorWebHost } from "ignite-element/actor-web/web";
import { igniteCore as igniteMobx } from "ignite-element/mobx";
import { igniteReact } from "ignite-element/react/web";
import { igniteCore as igniteRedux } from "ignite-element/redux";
import { igniteCore as igniteXState } from "ignite-element/xstate";
import { makeAutoObservable } from "mobx";
import { createElement } from "react";
import { createActor, createMachine } from "xstate";

const machine = createMachine({
	types: {} as {
		context: { count: number };
		events: { type: "SET"; value: number };
	},
	context: { count: 0 },
	initial: "ready",
	states: { ready: {} },
});
const source = createActor(machine).start();
const xstate = igniteXState({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		set: (value: number) => actor.send({ type: "SET", value }),
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
const xcount: number = source.getSnapshot().context.count;
xstate("packed-count", ({ count, set }) => (
	<button type="button" onClick={() => set(count + 1)}>
		{count}
	</button>
));
xstate("packed-display", ({ count }) => <output>{count}</output>);

const slice = createSlice({
	name: "count",
	initialState: { count: 0 },
	reducers: {
		set: (state, action: { payload: number }) => {
			state.count = action.payload;
		},
	},
});
const redux = igniteRedux({
	source: configureStore({ reducer: slice.reducer }),
	states: (snapshot) => ({ count: snapshot.count }),
	commands: ({ source: actor }) => ({
		set: (value: number) => actor.dispatch(slice.actions.set(value)),
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
const rcount: number = (await redux.execute({ command: "set", input: 2 }))
	.snapshot.count;

const mobx = igniteMobx({
	source: makeAutoObservable({
		count: 0,
		set(value: number) {
			this.count = value;
		},
	}),
	states: (snapshot) => ({ count: snapshot.count }),
	commands: ({ source: actor }) => ({
		set: (value: number) => actor.set(value),
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
const mcount: number = (await mobx.execute({ command: "set", input: 2 }))
	.snapshot.count;

declare const actorSource: ActorWebCommandSource<
	{ count: number },
	{ type: "SET"; value: number }
>;
const actorWeb = igniteActorWeb({
	source: actorSource,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		set: (value: number) => actor.send({ type: "SET", value }),
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
const acount: number = actorSource.snapshot().context.count;
void xcount;
void rcount;
void mcount;
void acount;

const counts: number[] = [
	xstate.get("states").count,
	redux.get("states").count,
	mobx.get("states").count,
	actorWeb.get("states").count,
];
void counts;
xstate.execute({ command: "set", input: 2 });
redux.execute({ command: "set", input: 2 });
mobx.execute({ command: "set", input: 2 });
actorWeb.execute({ command: "set", input: 2 });
xstate.on("changed", (fact) => {
	const count: number = fact.count;
	void count;
});
redux.on("changed", (fact) => {
	const count: number = fact.count;
	void count;
});
mobx.on("changed", (fact) => {
	const count: number = fact.count;
	void count;
});
actorWeb.on("changed", (fact) => {
	const count: number = fact.count;
	void count;
});
// @ts-expect-error invalid XState command input
xstate.execute({ command: "set", input: "bad" });
// @ts-expect-error invalid Redux command input
redux.execute({ command: "set", input: "bad" });
// @ts-expect-error invalid MobX command input
mobx.execute({ command: "set", input: "bad" });
// @ts-expect-error invalid Actor-Web command input
actorWeb.execute({ command: "set", input: "bad" });
// @ts-expect-error invalid XState event
xstate.on("missing", () => {});
// @ts-expect-error invalid Redux event
redux.on("missing", () => {});
// @ts-expect-error invalid MobX event
mobx.on("missing", () => {});
// @ts-expect-error invalid Actor-Web event
actorWeb.on("missing", () => {});
// @ts-expect-error unknown XState command
xstate.execute({ command: "missing" });
// @ts-expect-error unknown Redux command
redux.execute({ command: "missing" });
// @ts-expect-error unknown MobX command
mobx.execute({ command: "missing" });
// @ts-expect-error unknown Actor-Web command
actorWeb.execute({ command: "missing" });
// @ts-expect-error source-backed xstate runtime no longer records stories
xstate.record("removed");
// @ts-expect-error source-backed redux runtime no longer records stories
redux.record("removed");
// @ts-expect-error source-backed mobx runtime no longer records stories
mobx.record("removed");
// @ts-expect-error source-backed actorWeb runtime no longer records stories
actorWeb.record("removed");

const hostCore = igniteActorWebHost({
	source: ({ host }) => {
		const element: HTMLElement | undefined = host;
		const fleet: string | null | undefined = host?.getAttribute("fleet-id");
		void element;
		void fleet;
		return actorSource;
	},
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		setCount: (value: number) => actor.send({ type: "SET", value }),
		setOnline: (value: string) => value,
		setLabel: (value: string) => value,
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
const hostHandle = hostCore("packed-actor-web-host", ({ count, setCount }) => (
	<button type="button" onClick={() => setCount(count + 1)}>
		{count}
	</button>
));
hostHandle.get("schema");
hostHandle.get("commands");
hostHandle.get("events");
// @ts-expect-error Registration handles are discovery-only.
hostHandle.get("states");
// @ts-expect-error No dummy disposal on a registration handle.
hostHandle.dispose();
const Host = igniteReact(hostHandle);
const wrapped = createElement(Host, {
	count: "2",
	online: "yes",
	label: "control",
	onChanged: (event) => {
		const count: number = event.count;
		void count;
	},
});
// @ts-expect-error Web command payload typing remains strict.
hostCore.execute({ command: "setCount", input: "bad" });
void wrapped;
// @ts-expect-error Web setters remain string attributes, not headless numeric props.
createElement(Host, { count: 2 });
// @ts-expect-error Setter names beginning with on are still string attributes.
createElement(Host, { online: true });
