import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { assign, createActor, setup } from "xstate";
import type {
	ActorWebCommandSource,
	ActorWebSourceSnapshot,
	ActorWebTransportStatus,
} from "../actor-web";
import { igniteCore as igniteActorWeb } from "../actor-web";
import { igniteCore as igniteMobx } from "../mobx";
import { igniteCore as igniteRedux } from "../redux";
import { igniteCore as igniteXState } from "../xstate";

const counterMachine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "INC" },
	},
}).createMachine({
	context: { count: 0 },
	initial: "active",
	states: {
		active: {
			on: {
				INC: {
					actions: assign({
						count: ({ context }) => context.count + 1,
					}),
				},
			},
		},
	},
});

function createActorWebCounter(): ActorWebCommandSource<
	{ count: number },
	{ type: "INC" }
> {
	let count = 0;
	const listeners = new Set<
		(snapshot: ActorWebSourceSnapshot<{ count: number }>) => void
	>();
	const transport: ActorWebTransportStatus = {
		state: "connected",
		updatedAt: 1,
	};
	const source = {
		address: "actor://local/counter",
		snapshot: (): ActorWebSourceSnapshot<{ count: number }> => ({
			address: source.address,
			context: { count },
			phase: "active",
			toJSON: () => ({ count }),
		}),
		subscribe(
			listener: (snapshot: ActorWebSourceSnapshot<{ count: number }>) => void,
		) {
			listeners.add(listener);
			listener(source.snapshot());
			return () => listeners.delete(listener);
		},
		transportStatus: () => transport,
		async send(message: { type: "INC" }) {
			if (message.type === "INC") {
				count += 1;
				const snapshot = source.snapshot();
				for (const listener of listeners) listener(snapshot);
			}
		},
	};
	return source;
}

describe("v3 states/view public contract", () => {
	it("derives execute().states exactly once from the returned native XState snapshot", async () => {
		const actor = createActor(counterMachine).start();
		const seenSnapshots: unknown[] = [];
		const states = vi.fn((snapshot: ReturnType<typeof actor.getSnapshot>) => {
			seenSnapshots.push(snapshot);
			return { count: snapshot.context.count };
		});
		const counter = igniteXState({
			source: actor,
			states,
			commands: ({ actor: commandActor }) => ({
				increment: () => commandActor.send({ type: "INC" }),
			}),
		});

		states.mockClear();
		seenSnapshots.length = 0;
		const result = await counter.execute({ command: "increment" });

		expect(result).toMatchObject({ states: { count: 1 }, events: [] });
		expect(states).toHaveBeenCalledTimes(1);
		expect(Object.is(seenSnapshots[0], result.snapshot)).toBe(true);
		actor.stop();
	});

	it("uses one stable empty states object when states is omitted", () => {
		const counter = igniteXState({ source: counterMachine });
		const first = counter.getStates();
		const second = counter.getStates();

		expect(first).toEqual({});
		expect(Object.is(first, second)).toBe(true);
	});

	it("rejects the removed config view at runtime with migration guidance", () => {
		expect(() =>
			igniteXState({
				source: counterMachine,
				...({ view: () => ({ count: 0 }) } as Record<never, never>),
			}),
		).toThrow(/config.*view.*removed.*use.*states/i);
	});

	it("watches derived states from source-delivered snapshots", async () => {
		const actor = createActor(counterMachine).start();
		const counter = igniteXState({
			source: actor,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ actor: commandActor }) => ({
				increment: () => commandActor.send({ type: "INC" }),
			}),
		});
		const transitions: Array<[{ count: number }, { count: number }]> = [];
		const subscription = counter.watchStates((states, prevStates) => {
			transitions.push([states, prevStates]);
		});

		await counter.execute({ command: "increment" });

		expect(transitions[transitions.length - 1]).toEqual([
			{ count: 1 },
			{ count: 0 },
		]);
		subscription.unsubscribe();
		actor.stop();
	});

	it("awaits asynchronous command callbacks before sampling snapshot and states", async () => {
		const slice = createSlice({
			name: "counter",
			initialState: { count: 0 },
			reducers: {
				increment: (state) => {
					state.count += 1;
				},
			},
		});
		const store = configureStore({ reducer: slice.reducer });
		const counter = igniteRedux({
			source: store,
			states: (snapshot) => ({ count: snapshot.count }),
			commands: ({ actor }) => ({
				incrementLater: async () => {
					await Promise.resolve();
					actor.dispatch(slice.actions.increment());
				},
			}),
		});

		await expect(
			counter.execute({ command: "incrementLater" }),
		).resolves.toMatchObject({
			snapshot: { count: 1 },
			states: { count: 1 },
		});
	});

	it("projects states through Redux, MobX, and Actor-Web entrypoints", () => {
		const reduxSlice = createSlice({
			name: "redux-counter",
			initialState: { count: 2 },
			reducers: {},
		});
		const redux = igniteRedux({
			source: configureStore({ reducer: reduxSlice.reducer }),
			states: (snapshot) => ({ count: snapshot.count }),
		});

		const mobxStore = makeAutoObservable({ count: 3 });
		const mobx = igniteMobx({
			source: mobxStore,
			states: (snapshot) => ({ count: snapshot.count }),
		});

		const actorWeb = igniteActorWeb({
			source: createActorWebCounter(),
			states: (snapshot) => ({ count: snapshot.context.count }),
		});

		expect(redux.getStates()).toEqual({ count: 2 });
		expect(mobx.getStates()).toEqual({ count: 3 });
		expect(actorWeb.getStates()).toEqual({ count: 0 });
	});

	it("exposes states vocabulary through schema, stories, and tests", async () => {
		const counter = igniteXState({
			source: counterMachine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
		});

		expect(counter.getSchema()).toMatchObject({ states: { count: 0 } });
		expect(counter.getSchema()).not.toHaveProperty("view");

		const story = counter.record("counter increments");
		await story.execute({ command: "increment" });
		expect(story.summary()).toMatchObject({ finalStates: { count: 1 } });
		expect(story.trace()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "states", phase: "after" }),
			]),
		);
		story.stop();
	});
});
