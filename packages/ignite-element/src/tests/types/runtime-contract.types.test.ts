import type { RuntimeEvent } from "ignite-element";
import { igniteCore } from "ignite-element/redux";
import { expectTypeOf, it } from "vitest";
import counterStore, { counterSlice } from "../fixtures/reduxCounterStore";

it("retains command payload, native snapshot, state and discriminated event typing", () => {
	const store = counterStore();
	const core = igniteCore({
		source: store,
		states: (snapshot) => ({ count: snapshot.counter.count, label: "Counter" }),
		commands: ({ source: actor }) => ({
			increment: (amount: number) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount)),
			optional: (amount?: number) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount ?? 1)),
			decrement: () => actor.dispatch(counterSlice.actions.decrement()),
		}),
		events: (event) => ({
			changed: event<{ count: number }>(),
			failed: event<{ message: string }>(),
		}),
	});
	expectTypeOf<
		Awaited<ReturnType<typeof core.execute>>["snapshot"]
	>().toEqualTypeOf<ReturnType<typeof store.getState>>();
	expectTypeOf(core.get("states")).toEqualTypeOf<{
		count: number;
		label: string;
	}>();
	const validate = async () => {
		const result = await core.execute({ command: "increment", input: 2 });
		expectTypeOf(result.events).toEqualTypeOf<
			Array<
				{ type: "changed"; count: number } | { type: "failed"; message: string }
			>
		>();
		await core.execute({ command: "optional" });
		await core.execute({ command: "optional", input: 1 });
		await core.execute({ command: "decrement" });
		// @ts-expect-error required input remains required
		core.execute({ command: "increment" });
		// @ts-expect-error numeric command does not accept text
		core.execute({ command: "increment", input: "bad" });
		// @ts-expect-error no-argument commands reject spurious inputs
		core.execute({ command: "decrement", input: 1 });
		// @ts-expect-error unknown command remains invalid
		core.execute({ command: "missing" });
		// @ts-expect-error no recording member remains
		core.record("removed");
		// @ts-expect-error event variants retain their own payload
		const wrong: (typeof result.events)[number] = { type: "failed", count: 2 };
		void wrong;
		// @ts-expect-error unknown outward event remains invalid
		core.on("missing", () => {});
	};
	void validate;
	const subscription = core.on("changed", (event) =>
		expectTypeOf(event.count).toEqualTypeOf<number>(),
	);
	subscription.unsubscribe();
	expectTypeOf<RuntimeEvent>().toMatchTypeOf<{ type: string }>();
});
