import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import counterStore, {
	counterSlice,
} from "../../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../../IgniteCore";
import type { ReduxInstanceConfig, XStateConfig } from "../../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../../RenderArgs";
import { test as igniteTest } from "../../testing";

describe("ignite test DSL types", () => {
	it("infers command payloads, xstate value matching, and event payloads", async () => {
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

				emit("toggled", { isOn: isOn.current });
			},
		} satisfies XStateConfig<typeof machine, ToggleEventMap>;
		const component = igniteCore(componentConfig);

		const scenario = (await igniteTest(component)
			.given("off")
			.when("toggle"))
			.expectState("on")
			.expectEvent("toggled", { isOn: true });

		expectTypeOf(scenario.getResult().events).toEqualTypeOf<
			Array<{ type: "toggled"; payload: { isOn: boolean } }>
		>();
	});

	it("infers command payloads for redux runtimes", () => {
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

		igniteTest(component).when("increment", 2);

		expectTypeOf(igniteTest(component).expectState).toBeFunction();
	});
});
