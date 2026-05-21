import { describe, expect, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import counterStore, {
	counterSlice,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig, XStateConfig } from "../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../RenderArgs";
import { test as igniteTest } from "../testing";

describe("ignite test DSL", () => {
	it("drives xstate components through deterministic headless assertions", async () => {
		const machine = createMachine({
			initial: "off",
			states: {
				off: {
					on: {
						TOGGLE: "on",
					},
				},
				on: {
					on: {
						TOGGLE: "off",
					},
				},
			},
		});
		type ToggleSnapshot = StateFrom<typeof machine>;
		type ToggleEventMap = {
			toggled: EventDescriptor<{ isOn: boolean }>;
		};

		const componentConfig = {
			adapter: "xstate",
			source: machine,
			view: ({ snapshot }) => ({
				isOn: snapshot.matches("on"),
			}),
			commands: ({ actor }) => ({
				toggle: () => actor.send({ type: "TOGGLE" }),
			}),
			events: (event) => ({
				toggled: event<{ isOn: boolean }>(),
			}),
			effects: ({
				emit,
				select,
			}: FacadeEffectArgs<ToggleSnapshot, unknown, ToggleEventMap>) => {
				const isOn = select((snapshot) => snapshot.matches("on"));
				if (!isOn.changed) {
					return;
				}

				emit("toggled", {
					isOn: isOn.current,
				});
			},
		} satisfies XStateConfig<typeof machine, ToggleEventMap>;
		const component = igniteCore(componentConfig);

		(await igniteTest(component)
			.given("off")
			.when("toggle"))
			.expectState("on")
			.expectEvent("toggled", { isOn: true });
	});

	it("matches partial state and event payloads for redux runtimes", async () => {
		const store = counterStore();

		const componentConfig = {
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({ snapshot, prevSnapshot, emit }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<
			typeof store,
			{
				"counter-incremented": EventDescriptor<{ count: number }>;
			},
			Record<never, never>,
			{
				increment: (amount: number) => unknown;
			}
		>;
		const component = igniteCore(componentConfig);

		const result = (await igniteTest(component)
			.given({ counter: { count: 0 } })
			.when("increment", 2))
			.expectState({ counter: { count: 2 } })
			.expectEvents([
				{
					type: "counter-incremented",
					payload: { count: 2 },
				},
			])
			.getResult();

		expect(result.state.counter.count).toBe(2);
		expect(result.events).toEqual([
			{
				type: "counter-incremented",
				payload: { count: 2 },
			},
		]);
	});

	it("throws a useful error when execution assertions run before when()", () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
		});

		expect(() => igniteTest(component).expectNoEvents()).toThrow(
			"[igniteTest] No command has been executed yet. Call when() before asserting execution results.",
		);
	});
});
