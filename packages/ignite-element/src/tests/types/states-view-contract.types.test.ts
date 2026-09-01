import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore as igniteActorWeb } from "../../actor-web";
import { igniteCore as igniteMobx } from "../../mobx";
import { igniteCore as igniteRedux } from "../../redux";
import { test as igniteTest } from "../../testing";
import type { ToolStreamObservation } from "../../tools";
import { igniteTools } from "../../tools";
import { igniteCore as igniteXState } from "../../xstate";

describe("v3 states/view contract types", () => {
	it("infers native XState snapshots, states, renderer args, and headless results", () => {
		const machine = createMachine({
			context: { count: 0 },
			initial: "active",
			states: { active: {} },
		});
		type Snapshot = StateFrom<typeof machine>;
		const counter = igniteXState({
			source: machine,
			states: (snapshot) => {
				expectTypeOf(snapshot).toEqualTypeOf<Snapshot>();
				return { count: snapshot.context.count };
			},
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
		});

		expectTypeOf(counter.getSnapshot()).toEqualTypeOf<Snapshot>();
		expectTypeOf(counter.getStates()).toEqualTypeOf<{ count: number }>();
		counter.watchStates((states, prevStates) => {
			expectTypeOf(states).toEqualTypeOf<{ count: number }>();
			expectTypeOf(prevStates).toEqualTypeOf<{ count: number }>();
		});
		expectTypeOf(counter.getSchema().states).toEqualTypeOf<{
			count: number;
		}>();

		const inspectResult = async () => {
			const result = await counter.execute({ command: "increment" });
			expectTypeOf(result.snapshot).toEqualTypeOf<Snapshot>();
			expectTypeOf(result.states).toEqualTypeOf<{ count: number }>();
			expectTypeOf(result.events).toBeArray();
		};
		void inspectResult;

		counter("typed-state-view", (args) => {
			expectTypeOf(args.count).toEqualTypeOf<number>();
			expectTypeOf(args.increment).toEqualTypeOf<() => void>();
			// @ts-expect-error raw source state is not public renderer input
			void args.state;
			// @ts-expect-error raw send is not public renderer input
			void args.send;
			return null;
		});
	});

	it("rejects config view and preserves commands-only inference", () => {
		const machine = createMachine({
			initial: "idle",
			states: { idle: {} },
		});
		const invalidConfig = () =>
			igniteXState({
				source: machine,
				// @ts-expect-error config view was removed; use states
				view: ({ snapshot }) => ({ active: snapshot.matches("idle") }),
			});
		void invalidConfig;

		const commandsOnly = igniteXState({
			source: machine,
			commands: ({ actor }) => ({ ping: () => actor.send({ type: "PING" }) }),
		});
		expectTypeOf(commandsOnly.getStates()).toEqualTypeOf<
			Record<never, never>
		>();
	});

	it("infers states through Redux, MobX, and Actor-Web entrypoints", () => {
		const slice = createSlice({
			name: "counter",
			initialState: { count: 0 },
			reducers: {},
		});
		const redux = igniteRedux({
			source: configureStore({ reducer: slice.reducer }),
			states: (snapshot) => ({ count: snapshot.count }),
		});
		expectTypeOf(redux.getStates()).toEqualTypeOf<{ count: number }>();

		const mobx = igniteMobx({
			source: makeAutoObservable({ count: 0 }),
			states: (snapshot) => ({ count: snapshot.count }),
		});
		expectTypeOf(mobx.getStates()).toEqualTypeOf<{ count: number }>();

		const inferActorWeb = (
			actorWebSource: ActorWebCommandSource<{ count: number }, { type: "INC" }>,
		) => {
			const actorWeb = igniteActorWeb({
				source: actorWebSource,
				states: (snapshot) => ({ count: snapshot.context.count }),
			});
			expectTypeOf(actorWeb.getStates()).toEqualTypeOf<{ count: number }>();
		};
		void inferActorWeb;
	});

	it("threads states through stories, testing, and tools", () => {
		const machine = createMachine({
			initial: "idle",
			states: { idle: {} },
		});
		const component = igniteXState({
			source: machine,
			states: (snapshot) => ({ idle: snapshot.matches("idle") }),
			commands: ({ actor }) => ({ ping: () => actor.send({ type: "PING" }) }),
		});

		expectTypeOf(
			component.record("story").summary().finalStates,
		).toEqualTypeOf<{
			idle: boolean;
		}>();
		expectTypeOf(igniteTest({ component }).expectStates).toBeFunction();

		const tools = igniteTools(component);
		const inspectTools = async () => {
			const result = await tools.run({ name: "ping", input: undefined });
			if (result.ok) {
				expectTypeOf(result.value.states).toEqualTypeOf<{ idle: boolean }>();
			}
		};
		void inspectTools;

		tools.observe((observation) => {
			expectTypeOf(observation).toEqualTypeOf<
				ToolStreamObservation<{ idle: boolean }, Record<never, never>>
			>();
			if (observation.type === "states") {
				expectTypeOf(observation.states).toEqualTypeOf<{ idle: boolean }>();
				expectTypeOf(observation.prevStates).toEqualTypeOf<{
					idle: boolean;
				}>();
			}
		});
	});
});
