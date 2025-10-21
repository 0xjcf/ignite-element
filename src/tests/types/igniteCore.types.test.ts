import { makeAutoObservable } from "mobx";
import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type EventFrom } from "xstate";
import type { MobxEvent } from "../../adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateActorInstance,
} from "../../adapters/XStateAdapter";
import counterStore, {
	counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../../IgniteCore";
import type {
	FacadeCommandsCallback,
	FacadeStatesCallback,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../../RenderArgs";
import type { InferStateAndEvent } from "../../utils/igniteRedux";

type ExtractRenderArgs<F> = F extends (name: string, render: infer R) => void
	? R extends (args: infer A) => unknown
		? A
		: never
	: never;

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
		type Snapshot = ExtendedState<Machine>;
		type MachineActor = XStateActorInstance<Machine>;

		const statesCallback: FacadeStatesCallback<Snapshot, { double: number }> = (
			snapshot,
		) => ({ double: snapshot.context.count * 2 });
		const commandsCallback: FacadeCommandsCallback<
			MachineActor,
			{ increment: () => void }
		> = (actor) => ({ increment: () => actor.send({ type: "INC" }) });

		const register = igniteCore({
			adapter: "xstate",
			source: machine,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = ExtractRenderArgs<typeof register>;

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

		const statesCallback: FacadeStatesCallback<
			SliceState,
			{ count: number }
		> = (snapshot) => ({ count: snapshot.counter.count });
		const commandsCallback: FacadeCommandsCallback<
			SliceActor,
			{ increment: () => void }
		> = (actor) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: counterSlice,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = ExtractRenderArgs<typeof register>;

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

		const statesCallback: FacadeStatesCallback<
			StoreState,
			{ count: number }
		> = (snapshot) => ({ count: snapshot.counter.count });
		const commandsCallback: FacadeCommandsCallback<
			StoreActor,
			{ increment: () => void }
		> = (actor) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = ExtractRenderArgs<typeof register>;

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

		const statesCallback: FacadeStatesCallback<
			StoreState,
			{ count: number }
		> = (snapshot) => ({ count: snapshot.count });
		const commandsCallback: FacadeCommandsCallback<
			StoreState,
			{ increment: () => void }
		> = (storeInstance) => ({ increment: () => storeInstance.increment() });

		const register = igniteCore({
			adapter: "mobx",
			source: createStore,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = ExtractRenderArgs<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<StoreState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: StoreEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});
});
