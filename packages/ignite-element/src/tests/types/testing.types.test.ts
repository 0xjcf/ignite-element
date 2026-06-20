import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import counterStore, {
	counterSlice,
} from "../../examples/adapters/redux/src/js/reduxCounterStore";
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

		const scenario = (await igniteTest(component).given("off").when("toggle"))
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

	it("types expectView from the runtime's view projection", () => {
		const machine = createMachine({
			initial: "off",
			states: {
				off: { on: { TOGGLE: "on" } },
				on: { on: { TOGGLE: "off" } },
			},
		});

		const component = igniteCore({
			adapter: "xstate",
			source: machine,
			view: ({ snapshot }) => ({
				isOn: snapshot.matches("on"),
				label: "Power",
			}),
			commands: ({ actor }) => ({
				toggle: () => actor.send({ type: "TOGGLE" }),
			}),
		});

		// The runtime surface projects the typed view from the `view` callback.
		expectTypeOf(component.getView()).toEqualTypeOf<{
			isOn: boolean;
			label: string;
		}>();

		// The test DSL extracts that same projection (intersected with the
		// `Record<string, unknown>` scenario constraint), so expectView's predicate
		// sees the projection keys with their value types — not `unknown`. Wrapped in
		// an uncalled function: the body is typechecked, but the predicate is never
		// run (these `.types.test.ts` files also execute under vitest, and the
		// freshly-created component's view would not satisfy the assertion at runtime).
		const expectViewTyping = () => {
			igniteTest(component).expectView((view) => {
				expectTypeOf(view).toEqualTypeOf<
					{ isOn: boolean; label: string } & Record<string, unknown>
				>();
				expectTypeOf(view.isOn).toEqualTypeOf<boolean>();
				expectTypeOf(view.label).toEqualTypeOf<string>();
				return view.isOn && view.label.startsWith("P");
			});
		};

		void expectViewTyping;
	});
});
