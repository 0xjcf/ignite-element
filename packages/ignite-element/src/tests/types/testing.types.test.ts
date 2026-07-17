import { describe, expectTypeOf, it } from "vitest";
import { createMachine, type StateFrom } from "xstate";
import { igniteCore } from "../../IgniteCore";
import type { ReduxInstanceConfig, XStateConfig } from "../../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../../RenderArgs";
import { test as igniteTest } from "../../testing";
import counterStore, { counterSlice } from "../fixtures/reduxCounterStore";

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
			failed: EventDescriptor<{ message: string }>;
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
				failed: event<{ message: string }>(),
			}),
			effects: ({
				emit,
				select,
			}: FacadeEffectArgs<ToggleSnapshot, unknown, ToggleEventMap>) => {
				const isOn = select((snapshot) => snapshot.matches("on"));
				if (!isOn.changed) {
					return;
				}

				emit({
					type: "toggled",
					isOn: isOn.current,
				});
			},
		} satisfies XStateConfig<typeof machine, ToggleEventMap>;
		const component = igniteCore(componentConfig);

		const scenario = (
			await igniteTest(component)
				.given({ value: "off" })
				.when({ command: "toggle" })
		)
			.expectSnapshot({ value: "on" })
			.expectEvent({ type: "toggled", isOn: true });

		expectTypeOf(scenario.getResult().events).toEqualTypeOf<
			Array<
				{ type: "toggled"; isOn: boolean } | { type: "failed"; message: string }
			>
		>();
		const expectEventTypePairing = () => {
			// @ts-expect-error - `isOn` belongs to `toggled`, not `failed`
			scenario.expectEvent({ type: "failed", isOn: true });
			scenario.expectEvents([
				// @ts-expect-error - `message` belongs to `failed`, not `toggled`
				{ type: "toggled", message: "not paired" },
			]);
		};
		void expectEventTypePairing;
	});

	it("infers command payloads for redux runtimes", () => {
		const store = counterStore();
		const componentConfig = {
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
				maybeIncrement: (amount?: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount ?? 1)),
				decrement: command(
					() => actor.dispatch(counterSlice.actions.decrement()),
					{
						canExecute: ({ snapshot }) => snapshot.counter.count > 0,
					},
				),
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
				decrement: () => unknown;
			}
		>;
		const component = igniteCore(componentConfig);

		const expectWhenTyping = () => {
			igniteTest(component).when({ command: "increment", input: 2 });
			igniteTest(component).when({ command: "decrement" });
			igniteTest(component).when({ command: "maybeIncrement" });
			igniteTest(component).when({ command: "maybeIncrement", input: 3 });
		};
		expectTypeOf(
			igniteTest(component).canExecute("decrement"),
		).toEqualTypeOf<boolean>();

		const expectCommandNameValidation = () => {
			// @ts-expect-error - required command input must be present
			igniteTest(component).when({ command: "increment" });
			// @ts-expect-error - no-arg commands do not accept input
			igniteTest(component).when({ command: "decrement", input: 1 });
			// @ts-expect-error - invalid command input type
			igniteTest(component).when({ command: "increment", input: "2" });
			// @ts-expect-error - `when` is typed to known command names
			igniteTest(component).when({ command: "missing" });
			// @ts-expect-error - positional overload is removed in favor of object form
			igniteTest(component).when("increment", 2);
			// @ts-expect-error - canExecute is typed to known command names
			igniteTest(component).canExecute("missing");
		};

		expectTypeOf(igniteTest(component).expectSnapshot).toBeFunction();
		void expectWhenTyping;
		void expectCommandNameValidation;
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

	it("types the optional headless scenario host seam", () => {
		const machine = createMachine({
			initial: "idle",
			states: { idle: {} },
		});
		const component = igniteCore({
			adapter: "xstate",
			source: machine,
			commands: ({ actor, host }) => ({
				readHost: () => {
					void host.dataset.moduleId;
					actor.send({ type: "PING" });
				},
			}),
		});

		const hostOptionTyping = () => {
			const host = document.createElement("section");
			igniteTest(component, { host }).canExecute("readHost");

			// @ts-expect-error - the host seam must satisfy the HTMLElement contract
			igniteTest(component, { host: new EventTarget() });
		};

		void hostOptionTyping;
	});

	it("types named narratives with object-form command steps and checkpoint evidence", () => {
		const store = counterStore();
		const componentConfig = {
			adapter: "redux",
			source: store,
			view: ({ snapshot }) => ({
				count: snapshot.counter.count,
				canDecrement: snapshot.counter.count > 0,
			}),
			commands: ({ actor, command }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
				maybeIncrement: (amount?: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount ?? 1)),
				decrement: command(
					() => actor.dispatch(counterSlice.actions.decrement()),
					{
						canExecute: ({ snapshot }) => snapshot.counter.count > 0,
					},
				),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({ snapshot, prevSnapshot, emit }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit({
					type: "counter-incremented",
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<
			typeof store,
			{
				"counter-incremented": EventDescriptor<{ count: number }>;
			},
			{
				count: number;
				canDecrement: boolean;
			},
			{
				increment: (amount: number) => unknown;
				maybeIncrement: (amount?: number) => unknown;
				decrement: () => unknown;
			}
		>;
		const component = igniteCore(componentConfig);

		const expectNarrativeTyping = async () => {
			const story = await igniteTest(component).narrative(
				"counter flow",
				async (narrative) => {
					narrative.given({
						snapshot: { counter: { count: 0 } },
						view: { count: 0, canDecrement: false },
						canExecute: { decrement: false },
					});
					await narrative.intent({ command: "increment", input: 2 });
					await narrative.intent({ command: "maybeIncrement" });
					narrative.checkpoint("after increment", {
						snapshot: { counter: { count: 3 } },
						view: { count: 3, canDecrement: true },
						events: [{ type: "counter-incremented", count: 3 }],
						canExecute: { decrement: true },
					});

					const expectCommandValidation = () => {
						// @ts-expect-error - required command input must be present
						narrative.intent({ command: "increment" });
						// @ts-expect-error - no-arg commands do not accept input
						narrative.intent({ command: "decrement", input: 1 });
						// @ts-expect-error - invalid command names stay rejected
						narrative.intent({ command: "missing" });
					};

					void expectCommandValidation;
				},
			);

			expectTypeOf(story.summary.commandCount).toEqualTypeOf<number>();
		};

		void expectNarrativeTyping;
	});
});
