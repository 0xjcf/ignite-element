import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as actorWebCore } from "ignite-element/actor-web";
import { jsx } from "ignite-element/jsx/jsx-runtime";
import { igniteCore as mobxCore } from "ignite-element/mobx";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { igniteCore as xstateCore } from "ignite-element/xstate";
import { makeAutoObservable } from "mobx";
import { assign, createActor, createMachine } from "xstate";

const machine = createMachine({
	context: { count: 0 },
	on: {
		INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		increment(state) {
			state.count++;
		},
	},
});
function actorWebSource() {
	let count = 0;
	const snapshot = () => ({
		address: "counter",
		context: { count },
		phase: "active",
		toJSON: () => ({ count }),
	});
	const listeners = new Set<(value: ReturnType<typeof snapshot>) => void>();
	return {
		address: "counter",
		snapshot,
		transportStatus: () => ({ state: "disconnected" as const, updatedAt: 0 }),
		subscribe: (listener: (value: ReturnType<typeof snapshot>) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		send: async () => {},
		close() {},
		increment() {
			count++;
			for (const listener of listeners) listener(snapshot());
		},
	};
}
export async function sharedLifecycle(kind: string, withEffects: boolean) {
	const xstate = createActor(machine).start();
	const redux = configureStore({ reducer: slice.reducer });
	const mobx = makeAutoObservable({
		count: 0,
		increment() {
			this.count++;
		},
	});
	const actorWeb = actorWebSource();
	const evaluations: number[] = [];
	const evaluated = (count: number) => evaluations.push(count);
	const makeCore = () =>
		kind === "xstate"
			? xstateCore({
					source: xstate,
					states: (s) => ({ count: s.context.count }),
					commands: ({ source }) => ({
						increment: () => source.send({ type: "INC" }),
					}),
					events: (e) => ({ changed: e<{ count: number }>() }),
					effects: withEffects
						? ({ select, emit }) => {
								const count = select((s) => s.context.count);
								evaluated(count.current);
								if (count.changed)
									emit({ type: "changed", count: count.current });
							}
						: undefined,
				})
			: kind === "redux"
				? reduxCore({
						source: redux,
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							increment: () => store.dispatch(slice.actions.increment()),
						}),
						events: (e) => ({ changed: e<{ count: number }>() }),
						effects: withEffects
							? ({ select, emit }) => {
									const count = select((s) => s.count);
									evaluated(count.current);
									if (count.changed)
										emit({ type: "changed", count: count.current });
								}
							: undefined,
					})
				: kind === "mobx"
					? mobxCore({
							source: mobx,
							states: (s) => ({ count: s.count }),
							commands: ({ source: store }) => ({
								increment: () => store.increment(),
							}),
							events: (e) => ({ changed: e<{ count: number }>() }),
							effects: withEffects
								? ({ select, emit }) => {
										const count = select((s) => s.count);
										evaluated(count.current);
										if (count.changed)
											emit({ type: "changed", count: count.current });
									}
								: undefined,
						})
					: actorWebCore({
							source: actorWeb,
							states: (s) => ({ count: s.context.count }),
							commands: () => ({ increment: () => actorWeb.increment() }),
							events: (e) => ({ changed: e<{ count: number }>() }),
							effects: withEffects
								? ({ select, emit }) => {
										const count = select((s) => s.context.count);
										evaluated(count.current);
										if (count.changed)
											emit({ type: "changed", count: count.current });
									}
								: undefined,
						});

	const core = makeCore();
	const tag = "lifecycle-counter";
	core(tag, (ctx) =>
		jsx("button", { children: ctx.count, onClick: () => ctx.increment() }),
	);
	const first = document.createElement(tag),
		second = document.createElement(tag),
		parent = document.createElement("section");
	const events: number[] = [];
	first.addEventListener("changed", (event) => {
		if (event instanceof CustomEvent) events.push(event.detail.count);
	});
	try {
		document.body.append(first, second, parent);
		first.shadowRoot?.querySelector("button")?.click();
		const shared = second.shadowRoot?.textContent;
		parent.append(first);
		await Promise.resolve();
		const moved = first.shadowRoot?.textContent;
		first.remove();
		second.remove();
		await Promise.resolve();
		await core.execute({ command: "increment" });
		document.body.append(first);
		const reconnected = first.shadowRoot?.textContent;
		first.shadowRoot?.querySelector("button")?.click();
		await Promise.resolve();
		const commanded = first.shadowRoot?.textContent;
		core.dispose();
		core.dispose();
		const cleared = first.shadowRoot?.textContent;
		return {
			shared,
			moved,
			reconnected,
			commanded,
			cleared,
			events,
			evaluations,
			borrowedStatus: xstate.getSnapshot().status,
		};
	} finally {
		first.remove();
		second.remove();
		parent.remove();
		core.dispose();
		xstate.stop();
	}
}
