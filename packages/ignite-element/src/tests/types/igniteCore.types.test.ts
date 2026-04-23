import { makeAutoObservable } from "mobx";
import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type EventFrom } from "xstate";
import type { MobxEvent } from "../../adapters/MobxAdapter";
import type { XStateSnapshot } from "../../adapters/XStateAdapter";
import counterStore, {
	counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../../IgniteCore";
import type { AdapterPack } from "../../IgniteElementFactory";
import type { XStateConfig } from "../../igniteCore/types";
import type {
	CommandContext,
	EffectContext,
	EventBuilder,
	EventDescriptor,
	IgniteSchemaValue,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../../RenderArgs";
import type {
	IgniteStoryLifecycleEntry,
	IgniteStoryTraceEntry,
} from "../../types/agent";
import type { InferStateAndEvent } from "../../utils/igniteRedux";

describe("igniteCore type inference", () => {
	it("infers xstate snapshot and actor facades", () => {
		const machine = createMachine({
			context: { count: 0 },
			initial: "idle",
			states: {
				idle: {
					on: {
						INC: {
							actions: ({ context }) => ({
								context: { count: context.count + 1 },
							}),
						},
					},
				},
			},
		});

		type Machine = typeof machine;
		type Snapshot = XStateSnapshot<Machine>;

		const register = igniteCore({
			adapter: "xstate",
			source: machine,
			view: ({ snapshot }: { snapshot: Snapshot }) => ({
				double: snapshot.context.count * 2,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: EventFrom<Machine>) => void
		>();
		expectTypeOf<RenderArgs["double"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers xstate types when adapter is omitted", () => {
		const machine = createMachine({
			context: { count: 1 },
			initial: "active",
			states: { active: {} },
		});

		type Machine = typeof machine;
		type Snapshot = XStateSnapshot<Machine>;

		const register = igniteCore({
			source: machine,
			states: (snapshot: Snapshot) => ({
				count: snapshot.context.count,
			}),
			commands: ({ actor }) => ({
				ping: () => actor.send({ type: "PING" }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: EventFrom<Machine>) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["ping"]>().toEqualTypeOf<() => void>();
	});

	it("types the effects emit helper based on declared events", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCore({
			adapter: "xstate",
			source: machine,
			events: (event) => ({
				"checkout-submitted": event<{ email: string }>(),
			}),
			commands: ({ actor }) => ({
				submit: () => {
					actor.send({ type: "PING" });
				},
			}),
			effects: (_snapshot, _prevSnapshot, { emit }) => {
				emit("checkout-submitted", { email: "user@example.com" });
			},
		});

		igniteCore({
			adapter: "xstate",
			source: machine,
			commands: ({ actor, host }) => ({
				noop: () => {
					void actor;
					void host;
				},
			}),
		});
	});

	it("types effects emit when effects appear before events", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		const config = {
			adapter: "xstate",
			source: machine,
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: (_snapshot, _prevSnapshot, { emit }) => {
				emit("leaderboardRefresh", { tournamentId: "t-1", sort: "alpha" });
				// @ts-expect-error - typo in event name should be rejected
				emit("leaderboadRefresh", { tournamentId: "t-1", sort: "alpha" });
			},
			events: (event) => ({
				leaderboardRefresh: event<{
					tournamentId: string;
					sort: "alpha" | "beta";
				}>(),
			}),
		} satisfies XStateConfig<
			typeof machine,
			{
				leaderboardRefresh: EventDescriptor<{
					tournamentId: string;
					sort: "alpha" | "beta";
				}>;
			}
		>;

		igniteCore(config);
	});

	it("keeps effects emit typed for leaderboard workflows with events declared last", () => {
		type SortKey = "alpha" | "beta";

		const leaderboardMachine = createMachine({
			context: {
				tournaments: [] as { id: string }[],
				activeTournamentId: "t-1",
				sort: "alpha" as SortKey,
				leaderboard: [],
				joined: false,
				lastError: null as string | null,
				nextRefresh: undefined as number | undefined,
			},
			initial: "ready",
			states: {
				ready: {},
			},
		});

		igniteCore({
			adapter: "xstate",
			source: leaderboardMachine,
			states: (snapshot) => ({
				leaderboard: snapshot.context.leaderboard,
				sort: snapshot.context.sort,
			}),
			commands: ({ actor }) => ({
				trigger: () => {
					actor.send({ type: "PING" });
				},
			}),
			effects: (_snapshot, _prevSnapshot, { actor, emit }) => {
				const { activeTournamentId, sort } = actor.state.context;
				emit("leaderboardRefresh", {
					tournamentId: activeTournamentId,
					sort,
				});
				// @ts-expect-error - typo should be rejected
				emit("leaderdRfresh", {
					tournamentId: activeTournamentId,
					sort,
				});
			},
			events: (event: EventBuilder) => ({
				playerJoined: event<{ tournamentId: string }>(),
				playerLeft: event<{ tournamentId: string }>(),
				finalized: event<{ tournamentId: string }>(),
				leaderboardRefresh: event<{ tournamentId: string; sort: SortKey }>(),
			}),
		});
	});

	it("allows optional payload for effects events with undefined payload", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCore({
			adapter: "xstate",
			source: machine,
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: (_snapshot, _prevSnapshot, { emit }) => {
				emit("optional-payload");
				emit("optional-payload", { id: "123" });
				emit("optional-payload", undefined);

				// @ts-expect-error - payload is required
				emit("required-payload");
				emit("required-payload", { id: "123" });
			},
			events: (event: EventBuilder) => ({
				"optional-payload": event<{ id?: string } | undefined>(),
				"required-payload": event<{ id: string }>(),
			}),
		});
	});

	it("infers effects events when adapter is inferred from source", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCore({
			source: machine,
			events: (event) => ({
				"pinged-event": event<{ id: string }>(),
			}),
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: (_snapshot, _prevSnapshot, { emit }) => {
				emit("pinged-event", { id: "123" });
				// @ts-expect-error - payload is required
				emit("pinged-event");
			},
		});
	});

	it("rejects emit in command context", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		const assertNoCommandEmit = () => {
			igniteCore({
				adapter: "xstate",
				source: machine,
				events: (event) => ({
					legacy: event<{ email: string }>(),
				}),
				commands: (
					// @ts-expect-error emit has been removed from command context
					{ emit },
				) => ({
					trigger: () => {
						void emit;
					},
				}),
			});
		};

		void assertNoCommandEmit;

		igniteCore({
			adapter: "xstate",
			source: machine,
			events: (event) => ({
				legacy: event<{ email: string }>(),
			}),
			commands: ({ actor, host }) => ({
				trigger: () => {
					void actor;
					void host;
				},
			}),
		});
	});

	it("types the agent runtime surface", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		const register = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }: { snapshot: StoreState }) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({
				snapshot,
				prevSnapshot,
				emit,
				select,
			}: {
				snapshot: StoreState;
				prevSnapshot: StoreState;
			} & EffectContext<
				ReduxStoreCommandActor<typeof store>,
				{
					"counter-incremented": EventDescriptor<{ count: number }>;
				},
				HTMLElement,
				StoreState
			>) => {
				const count = select((state) => state.counter.count);
				expectTypeOf(count.current).toEqualTypeOf<number>();
				expectTypeOf(count.previous).toEqualTypeOf<number>();
				expectTypeOf(count.changed).toEqualTypeOf<boolean>();

				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		});

		const result = register.execute("increment", 2);
		const schema = register.getSchema();
		expectTypeOf(result.state).toEqualTypeOf<StoreState>();
		expectTypeOf(register.getView()).toEqualTypeOf<{ count: number }>();
		expectTypeOf(schema.commands).toEqualTypeOf<
			Record<string, IgniteSchemaValue>
		>();
		expectTypeOf(schema.events).toEqualTypeOf<string[]>();
		expectTypeOf(schema.state).toEqualTypeOf<IgniteSchemaValue>();
		register.on("counter-incremented", (event) => {
			expectTypeOf(event.detail).toEqualTypeOf<{ count: number }>();
		});
		register.watch((state, prevState) => {
			expectTypeOf(state).toEqualTypeOf<StoreState>();
			expectTypeOf(prevState).toEqualTypeOf<StoreState>();
		});
		register.watchView((view, prevView) => {
			expectTypeOf(view).toEqualTypeOf<{ count: number }>();
			expectTypeOf(prevView).toEqualTypeOf<{ count: number }>();
		});

		const story = register.record("typed counter");
		const storyResult = story.execute("increment", 2);
		const storyView = story.until(
			(view) => view.count >= 4,
			() => {
				story.execute("increment", 1);
			},
			{ maxSteps: 3 },
		);
		const storyTrace = story.trace();
		const storyLifecycle = story.lifecycle();
		const storySummary = story.summary();
		expectTypeOf(storyResult.state).toEqualTypeOf<StoreState>();
		expectTypeOf(storyView).toEqualTypeOf<{ count: number }>();
		expectTypeOf(storyTrace).toEqualTypeOf<IgniteStoryTraceEntry[]>();
		expectTypeOf(storyLifecycle).toEqualTypeOf<IgniteStoryLifecycleEntry[]>();
		expectTypeOf(storySummary.finalState).toEqualTypeOf<StoreState>();
		expectTypeOf(storySummary.finalView).toEqualTypeOf<{ count: number }>();
		expectTypeOf(storySummary.events).toEqualTypeOf<
			Array<{ type: "counter-incremented"; payload: { count: number } }>
		>();
		expectTypeOf(storySummary.commandCount).toEqualTypeOf<number>();
		expectTypeOf(storySummary.traceCount).toEqualTypeOf<number>();
		expectTypeOf(storySummary.lifecycleCount).toEqualTypeOf<number>();
		story.stop();

		const expectRuntimeValidation = () => {
			// @ts-expect-error - command name should be validated
			register.execute("incrementt", 2);
			// @ts-expect-error - story command name should be validated
			story.execute("incrementt", 2);
			// @ts-expect-error - event name should be validated
			register.on("counter-incrementedd", () => {});
		};

		void expectRuntimeValidation;
	});

	it("preserves command payload inference when metadata is attached", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				addByAmount: command(
					(amount: number) =>
						actor.dispatch(counterSlice.actions.addByAmount(amount)),
					{
						description: "Add a bounded amount to the counter.",
						input: command.number({ minimum: 1, maximum: 5 }),
					},
				),
			}),
		});

		register.execute("addByAmount", 2);
		const schema = register.getSchema();

		expectTypeOf(schema.commands).toEqualTypeOf<
			Record<string, IgniteSchemaValue>
		>();

		const expectPayloadValidation = () => {
			// @ts-expect-error - wrapped command payload should remain numeric
			register.execute("addByAmount", "2");
		};

		void expectPayloadValidation;
	});

	it("infers redux slice snapshot and actor facades", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceEvent = InferStateAndEvent<typeof counterSlice>["Event"];
		type SliceActor = ReduxSliceCommandActor<typeof counterSlice>;

		const statesCallback = (snapshot: SliceState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = ({ actor }: { actor: SliceActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: counterSlice,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<SliceState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: SliceEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers redux slice types when adapter is omitted", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceContext = CommandContext<
			ReduxSliceCommandActor<typeof counterSlice>
		>;
		const sliceStates = (snapshot: SliceState) => ({
			count: snapshot.counter.count,
		});
		const sliceCommands = ({ actor }: SliceContext) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			source: counterSlice,
			states: sliceStates,
			commands: sliceCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			InferStateAndEvent<typeof counterSlice>["State"]
		>();
	});

	it("infers redux store snapshot and actor facades", () => {
		const store = counterStore();
		type StoreInstance = typeof store;
		type StoreState = InferStateAndEvent<StoreInstance>["State"];
		type StoreEvent = InferStateAndEvent<StoreInstance>["Event"];
		type StoreActor = ReduxStoreCommandActor<StoreInstance>;

		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = ({ actor }: { actor: StoreActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<StoreState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: StoreEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers redux store types when adapter is omitted", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type StoreContext = CommandContext<ReduxStoreCommandActor<typeof store>>;
		const storeStates = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});
		const storeCommands = ({ actor }: StoreContext) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			source: store,
			states: storeStates,
			commands: storeCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			InferStateAndEvent<typeof store>["State"]
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers mobx snapshot and actor facades", () => {
		const createStore = () =>
			makeAutoObservable({
				count: 0,
				increment() {
					this.count += 1;
				},
			});

		type StoreState = ReturnType<typeof createStore>;
		type StoreEvent = MobxEvent<StoreState>;

		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.count,
		});
		const commandsCallback = ({
			actor: storeInstance,
		}: {
			actor: StoreState;
		}) => ({
			increment: () => storeInstance.increment(),
		});

		const register = igniteCore({
			adapter: "mobx",
			source: createStore,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<StoreState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: StoreEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers mobx types when adapter is omitted", () => {
		const sharedStore = makeAutoObservable({
			count: 0,
			increment() {
				this.count += 1;
			},
		});

		type SharedStore = typeof sharedStore;
		type SharedContext = CommandContext<SharedStore>;
		const sharedStates = (snapshot: SharedStore) => ({ count: snapshot.count });
		const sharedCommands = ({ actor: storeInstance }: SharedContext) => ({
			increment: () => storeInstance.increment(),
		});

		const register = igniteCore({
			source: sharedStore,
			states: sharedStates,
			commands: sharedCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<typeof sharedStore>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});
});
