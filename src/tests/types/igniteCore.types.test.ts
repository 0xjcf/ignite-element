import { makeAutoObservable } from "mobx";
import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type EventFrom } from "xstate";
import type { MobxEvent } from "../../adapters/MobxAdapter";
import type {
	XStateMachineActor,
	XStateSnapshot,
} from "../../adapters/XStateAdapter";
import counterStore, {
	counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../../IgniteCore";
import type { AdapterPack } from "../../IgniteElementFactory";
import type {
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
		type MachineActor = XStateMachineActor<Machine>;

		const statesCallback = (snapshot: Snapshot) => ({
			double: snapshot.context.count * 2,
		});
		const commandsCallback = (actor: MachineActor) => ({
			increment: () => actor.send({ type: "INC" }),
		});

		const register = igniteCore({
			adapter: "xstate",
			source: machine,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: EventFrom<Machine>) => void
		>();
		expectTypeOf<RenderArgs["double"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers redux slice snapshot and actor facades", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceEvent = InferStateAndEvent<typeof counterSlice>["Event"];
		type SliceActor = ReduxSliceCommandActor<typeof counterSlice>;

		const statesCallback = (snapshot: SliceState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = (actor: SliceActor) => ({
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

	it("infers redux store snapshot and actor facades", () => {
		const store = counterStore();
		type StoreInstance = typeof store;
		type StoreState = InferStateAndEvent<StoreInstance>["State"];
		type StoreEvent = InferStateAndEvent<StoreInstance>["Event"];
		type StoreActor = ReduxStoreCommandActor<StoreInstance>;

		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = (actor: StoreActor) => ({
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
		const commandsCallback = (storeInstance: StoreState) => ({
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
});
