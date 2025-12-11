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
	EmptyEventMap,
	EventBuilder,
	EventDescriptor,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../../RenderArgs";
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
			states: (snapshot: Snapshot) => ({
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

	it("types the emit helper based on declared events", () => {
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
			commands: ({ actor, emit }) => ({
				submit: () => {
					emit("checkout-submitted", { email: "user@example.com" });
					actor.send({ type: "PING" });
				},
			}),
		});

		igniteCore({
			adapter: "xstate",
			source: machine,
			commands: ({ emit }) => ({
				noop: () => {
					void emit;
				},
			}),
		});
	});

	it("types emit when commands appear before events", () => {
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
			commands: ({ emit }) => ({
				trigger: () => {
					emit("leaderboardRefresh", { tournamentId: "t-1", sort: "alpha" });
					// @ts-expect-error - typo in event name should be rejected
					emit("leaderboadRefresh", { tournamentId: "t-1", sort: "alpha" });
				},
			}),
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

	it("keeps emit typed for leaderboard commands with events declared last", () => {
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
			commands: ({ actor, emit }) => ({
				trigger: () => {
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
			}),
			events: (event: EventBuilder) => ({
				playerJoined: event<{ tournamentId: string }>(),
				playerLeft: event<{ tournamentId: string }>(),
				finalized: event<{ tournamentId: string }>(),
				leaderboardRefresh: event<{ tournamentId: string; sort: SortKey }>(),
			}),
		});
	});

	it("allows optional payload for events with undefined payload", () => {
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

			commands: ({ emit }) => ({
				trigger: () => {
					emit("optional-payload");
					emit("optional-payload", { id: "123" });
					emit("optional-payload", undefined);

					// @ts-expect-error - payload is required
					emit("required-payload");
					emit("required-payload", { id: "123" });
				},
			}),

			events: (event: EventBuilder) => ({
				"optional-payload": event<{ id?: string } | undefined>(),
				"required-payload": event<{ id: string }>(),
			}),
		});
	});

	it("infers events when adapter is inferred from source", () => {
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
			commands: ({ emit }) => ({
				trigger: () => {
					emit("pinged-event", { id: "123" });
					// @ts-expect-error - payload is required
					emit("pinged-event");
				},
			}),
		});
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
			ReduxSliceCommandActor<typeof counterSlice>,
			EmptyEventMap
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
		type StoreContext = CommandContext<
			ReduxStoreCommandActor<typeof store>,
			EmptyEventMap
		>;
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
		type SharedContext = CommandContext<SharedStore, EmptyEventMap>;
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
