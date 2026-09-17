import { describe, expect, it, vi } from "vitest";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../RenderArgs";
import type { InferStateAndEvent } from "../utils/igniteRedux";
import counterStore, { counterSlice } from "./fixtures/reduxCounterStore";

type RuntimeEventMap = {
	"counter-incremented": EventDescriptor<{ count: number }>;
};

function createRegister() {
	const store = counterStore();
	type StoreState = InferStateAndEvent<typeof store>["State"];
	type StoreStates = { count: number; isEven: boolean };

	const runtimeConfig = {
		adapter: "redux",
		source: store,
		states: (snapshot: StoreState): StoreStates => ({
			count: snapshot.counter.count,
			isEven: snapshot.counter.count % 2 === 0,
		}),
		commands: ({ source: actor }) => ({
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
			emit({
				type: "counter-incremented",
				count: count.current,
			});
		},
	} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;

	return { register: igniteCore(runtimeConfig), store };
}

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("headless runtime keyed reads and native-source observation", () => {
	it("keeps snapshots source-native and watches derived Ignite states", async () => {
		const { register, store } = createRegister();

		expect(register.get("states")).toEqual({ count: 0, isEven: true });

		const snapshotListener = vi.fn();
		const subscription = register.watch(snapshotListener);

		await register.execute({ command: "increment", input: 2 });

		expect(store.getState().counter.count).toBe(2);
		expect(register.get("states").count).toBe(2);
		expect(snapshotListener).toHaveBeenCalledTimes(1);

		subscription.unsubscribe();
	});

	// watch now deliberately observes derived states; raw aliases stay absent.
	it("retired raw aliases stay absent while watch is the approved states API", () => {
		const { register } = createRegister();

		// @ts-expect-error -- native getState belongs to the store.
		expect(register.getState).toBeUndefined();
		expect(typeof register.watch).toBe("function");
		// @ts-expect-error -- raw Ignite observation was retired.
		expect(register.watchSnapshot).toBeUndefined();
		// @ts-expect-error -- raw reads belong to the native source.
		expect(register.getSnapshot).toBeUndefined();
		// @ts-expect-error -- subscribe was removed at stable v3; use on.
		expect(register.subscribe).toBeUndefined();
	});

	it("does not warn for canonical object-form effects callbacks", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const { register } = createRegister();

			await register.execute({ command: "increment" });
			await flushMicrotasks();

			expect(warnSpy).not.toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});
});
