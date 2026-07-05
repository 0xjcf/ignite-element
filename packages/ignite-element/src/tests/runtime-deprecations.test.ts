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

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("headless runtime canonical snapshot accessors", () => {
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

	// The getState/watch/subscribe aliases were removed at stable v3 (T7).
	// Pin the removal so they cannot silently return.
	it("the deprecated getState/watch/subscribe aliases are gone", () => {
		const { register } = createRegister();

		// @ts-expect-error -- getState was removed at stable v3; use getSnapshot.
		expect(register.getState).toBeUndefined();
		// @ts-expect-error -- watch was removed at stable v3; use watchSnapshot.
		expect(register.watch).toBeUndefined();
		// @ts-expect-error -- subscribe was removed at stable v3; use on.
		expect(register.subscribe).toBeUndefined();
	});

	it("does not warn for canonical object-form effects callbacks", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const { register } = createRegister();

			await register.execute("increment");
			await flushMicrotasks();

			expect(warnSpy).not.toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});
});
