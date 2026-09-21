import type { RuntimeEvent } from "ignite-element";
import { igniteCore } from "ignite-element/redux";
import { expectTypeOf, it } from "vitest";
import counterStore, { counterSlice } from "../fixtures/reduxCounterStore";

it("retains command payload, command results, state and discriminated event typing", () => {
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
		Awaited<ReturnType<typeof core.execute>>
	>().toEqualTypeOf<void>();
	expectTypeOf(core.get("states")).toEqualTypeOf<{
		count: number;
		label: string;
	}>();
	const validate = async () => {
		const result = await core.execute({ command: "increment", input: 2 });
		expectTypeOf(result).toEqualTypeOf<void>();
		// @ts-expect-error execution no longer returns a snapshot receipt
		result.snapshot;
		// @ts-expect-error use explicit projected reads
		result.states;
		// @ts-expect-error events use public subscriptions
		result.events;
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
		type DeclaredEvent = RuntimeEvent<{
			changed: import("../../RenderArgs").EventDescriptor<{ count: number }>;
			failed: import("../../RenderArgs").EventDescriptor<{ message: string }>;
		}>;
		// @ts-expect-error event variants retain their own payload
		const wrong: DeclaredEvent = { type: "failed", count: 2 };
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
