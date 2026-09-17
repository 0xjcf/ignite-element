import { createReduxAdapter } from "@ignite-element/adapters/redux";
import {
	configureStore,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import {
	igniteCore,
	type ReduxStoreCommandActor,
	type ReduxBlueprintConfig,
} from "ignite-element/redux";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
	? 1
	: 2
	? true
	: false;

const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		increment: (state, action: PayloadAction<number>) => {
			state.count += action.payload;
		},
	},
});
const makeStore = () =>
	configureStore({
		reducer: slice.reducer,
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware({ thunk: { extraArgument: { multiplier: 2 } } }),
	});

// Compile-only contracts, also copied unchanged into the strict packed consumer.
export function reduxFactoryContracts() {
	// Middleware stays configured and typed on the original Redux store.
	const original = makeStore();
	const thunkResult = original.dispatch(
		(_dispatch, getState, extra) => getState().count * extra.multiplier,
	);
	const thunkIsNumber: Equal<typeof thunkResult, number> = true;
	void thunkIsNumber;
	createReduxAdapter(makeStore);
	const core = igniteCore({
		source: makeStore,
		states: (snapshot) => {
			const exact: Equal<typeof snapshot, { count: number }> = true;
			void exact;
			// @ts-expect-error Snapshot fields do not widen.
			snapshot.missing;
			return { count: snapshot.count };
		},
		commands: ({ source: store }) => {
			const exact: Equal<
				typeof store.dispatch,
				ReduxStoreCommandActor<ReturnType<typeof makeStore>>["dispatch"]
			> = true;
			void exact;
			// @ts-expect-error Resolved store is not its factory.
			store();
			// @ts-expect-error Native Redux actions are required.
			store.dispatch(42);
			const increment = (amount: number) => {
				store.dispatch(slice.actions.increment(amount));
				return store.getState().count;
			};
			return { increment };
		},
	});
	core("redux-factory-types", (ctx) => {
		const exact: Equal<typeof ctx.increment, (amount: number) => number> = true;
		void exact;
		// @ts-expect-error Command inputs retain their type.
		ctx.increment("bad");
		return null;
	});
	const states = core.get("states");
	const exact: Equal<typeof states, { count: number }> = true;
	void exact;
	core.execute({ command: "increment", input: 2 });
	// @ts-expect-error Headless command inputs retain their type.
	core.execute({ command: "increment", input: "bad" });
	igniteCore({ source: makeStore, adapter: "redux" });
	igniteCore({ source: makeStore() });
	igniteCore({ source: slice });
	igniteCore({
		source: makeStore,
		commands: ({ source }) => ({
			increment: () => source.dispatch(slice.actions.increment(1)),
		}),
	});
	const annotated: ReduxBlueprintConfig<typeof makeStore> = {
		source: makeStore,
	};
	igniteCore(annotated);
	// @ts-expect-error Dedicated import rejects a mismatched adapter.
	igniteCore({ source: makeStore, adapter: "mobx" });
	// @ts-expect-error A primitive is not a Redux store.
	igniteCore({ source: () => 1 });
	igniteCore({
		source: makeStore,
		// @ts-expect-error actor was removed from command contexts.
		commands: ({ actor }) => ({
			increment: () => actor.dispatch(slice.actions.increment(1)),
		}),
	});
}
