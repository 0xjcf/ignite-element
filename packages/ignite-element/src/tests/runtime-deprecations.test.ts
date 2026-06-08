import { afterEach, describe, expect, it, vi } from "vitest";
import counterStore, {
	counterSlice,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../RenderArgs";
import type { InferStateAndEvent } from "../utils/igniteRedux";

type RuntimeEventMap = {
	"counter-incremented": EventDescriptor<{ count: number }>;
};

function createRegister() {
	const store = counterStore();
	type StoreState = InferStateAndEvent<typeof store>["State"];
	type StoreView = { count: number; isEven: boolean };

	const runtimeConfig = {
		adapter: "redux",
		source: store,
		view: ({ snapshot }: { snapshot: StoreState }): StoreView => ({
			count: snapshot.counter.count,
			isEven: snapshot.counter.count % 2 === 0,
		}),
		commands: ({ actor }) => ({
			increment: (amount = 1) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount)),
		}),
		events: (event) => ({
			"counter-incremented": event<{ count: number }>(),
		}),
		effects: ({
			emit,
			select,
		}: FacadeEffectArgs<StoreState, unknown, RuntimeEventMap>) => {
			const count = select((state: StoreState) => state.counter.count);
			if (!count.changed) {
				return;
			}
			emit("counter-incremented", { count: count.current });
		},
	} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;

	return { register: igniteCore(runtimeConfig), store };
}

describe("headless runtime canonical snapshot accessors", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// NOTE: this test must not call the deprecated aliases (getState/watch/
	// subscribe). The once-per-process dev warning is tracked in module-level
	// state shared across tests in this file, so the alias-warning test below
	// owns the only invocations.
	it("getSnapshot/watchSnapshot are the canonical raw-read surface", async () => {
		const { register, store } = createRegister();

		expect(register.getSnapshot()).toEqual(store.getState());

		const snapshotListener = vi.fn();
		const subscription = register.watchSnapshot(snapshotListener);

		await register.execute("increment", 2);

		expect(register.getSnapshot().counter.count).toBe(2);
		expect(snapshotListener).toHaveBeenCalledTimes(1);

		subscription.unsubscribe();
	});

	it("getState/watch/subscribe still work and warn once per process (dev only)", () => {
		const { register, store } = createRegister();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// getState delegates to getSnapshot and warns at most once.
		expect(register.getState()).toEqual(store.getState());
		register.getState();
		const getStateWarnings = warn.mock.calls.filter((call) =>
			String(call[0]).includes("`getState` is deprecated"),
		);
		expect(getStateWarnings).toHaveLength(1);
		expect(getStateWarnings[0][0]).toContain("Use `getSnapshot`");

		// watch delegates to watchSnapshot and warns.
		const watchSubscription = register.watch(vi.fn());
		expect(
			warn.mock.calls.some((call) =>
				String(call[0]).includes("`watch` is deprecated"),
			),
		).toBe(true);
		watchSubscription.unsubscribe();

		// subscribe delegates to on and warns.
		const eventSubscription = register.subscribe(
			"counter-incremented",
			vi.fn(),
		);
		expect(
			warn.mock.calls.some((call) =>
				String(call[0]).includes("`subscribe` is deprecated"),
			),
		).toBe(true);
		eventSubscription.unsubscribe();
	});
});
