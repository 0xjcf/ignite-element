import { describe, expect, it } from "vitest";
import { assign, createMachine, type StateFrom } from "xstate";
import counterStore, {
	counterSlice,
} from "../examples/adapters/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig, XStateConfig } from "../igniteCore/types";
import type { EventDescriptor, FacadeEffectArgs } from "../RenderArgs";
import { jsx, jsxs } from "../renderers/jsx/jsx-runtime";
import { test as igniteTest } from "../testing";
import type { IgniteStory } from "../types/agent";

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

		(await igniteTest(component).given("off").when("toggle"))
			.expectState("on")
			.expectEvent("toggled", { isOn: true });
	});

	it("asserts the projected view with expectView (object, predicate, mismatch)", async () => {
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

		const scenario = await igniteTest(component).given("off").when("toggle");

		scenario
			// partial-object match against the projected view
			.expectView({ isOn: true, label: "Power" })
			// predicate form over the projected view
			.expectView((view) => view.isOn === true && view.label === "Power");

		expect(() => scenario.expectView({ isOn: false })).toThrow(
			/expectView failed/,
		);
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

		const result = (
			await igniteTest(component)
				.given({ counter: { count: 0 } })
				.when("increment", 2)
		)
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

	it("serializes story traces and matches ordered workflow checkpoints", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }) => ({
				count: snapshot.counter.count,
				isEven: snapshot.counter.count % 2 === 0,
			}),
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
			{
				count: number;
				isEven: boolean;
			},
			{
				increment: (amount: number) => unknown;
			}
		>);

		const story = component.record("counter story");
		await story.execute("increment", 2);
		await story.execute("increment", 1);

		const trace = igniteTest.serializeTrace(story.trace());
		const snapshot = igniteTest.snapshotStory(story);

		expect(trace).toEqual(snapshot.trace);
		expect(snapshot).toMatchInlineSnapshot(`
			{
			  "lifecycle": [],
			  "name": "counter story",
			  "summary": {
			    "commandCount": 2,
			    "events": [
			      {
			        "payload": {
			          "count": 2,
			        },
			        "type": "counter-incremented",
			      },
			      {
			        "payload": {
			          "count": 3,
			        },
			        "type": "counter-incremented",
			      },
			    ],
			    "finalState": {
			      "counter": {
			        "count": 3,
			      },
			    },
			    "finalView": {
			      "count": 3,
			      "isEven": false,
			    },
			    "lifecycleCount": 0,
			    "name": "counter story",
			    "traceCount": 12,
			  },
			  "trace": [
			    {
			      "command": "increment",
			      "kind": "command",
			      "payload": 2,
			      "sequence": 1,
			      "step": 1,
			    },
			    {
			      "kind": "state",
			      "phase": "before",
			      "sequence": 2,
			      "state": {
			        "counter": {
			          "count": 0,
			        },
			      },
			      "step": 1,
			    },
			    {
			      "kind": "view",
			      "phase": "before",
			      "sequence": 3,
			      "step": 1,
			      "view": {
			        "count": 0,
			        "isEven": true,
			      },
			    },
			    {
			      "event": "counter-incremented",
			      "kind": "event",
			      "payload": {
			        "count": 2,
			      },
			      "sequence": 4,
			      "step": 1,
			    },
			    {
			      "kind": "state",
			      "phase": "after",
			      "sequence": 5,
			      "state": {
			        "counter": {
			          "count": 2,
			        },
			      },
			      "step": 1,
			    },
			    {
			      "kind": "view",
			      "phase": "after",
			      "sequence": 6,
			      "step": 1,
			      "view": {
			        "count": 2,
			        "isEven": true,
			      },
			    },
			    {
			      "command": "increment",
			      "kind": "command",
			      "payload": 1,
			      "sequence": 7,
			      "step": 2,
			    },
			    {
			      "kind": "state",
			      "phase": "before",
			      "sequence": 8,
			      "state": {
			        "counter": {
			          "count": 2,
			        },
			      },
			      "step": 2,
			    },
			    {
			      "kind": "view",
			      "phase": "before",
			      "sequence": 9,
			      "step": 2,
			      "view": {
			        "count": 2,
			        "isEven": true,
			      },
			    },
			    {
			      "event": "counter-incremented",
			      "kind": "event",
			      "payload": {
			        "count": 3,
			      },
			      "sequence": 10,
			      "step": 2,
			    },
			    {
			      "kind": "state",
			      "phase": "after",
			      "sequence": 11,
			      "state": {
			        "counter": {
			          "count": 3,
			        },
			      },
			      "step": 2,
			    },
			    {
			      "kind": "view",
			      "phase": "after",
			      "sequence": 12,
			      "step": 2,
			      "view": {
			        "count": 3,
			        "isEven": false,
			      },
			    },
			  ],
			}
		`);

		expect(
			igniteTest.expectTrace(trace, [
				{ kind: "command", command: "increment", payload: 2 },
				{ kind: "event", event: "counter-incremented", payload: { count: 2 } },
				(entry) =>
					entry.kind === "view" && entry.phase === "after" && entry.step === 2,
			]),
		).toEqual(trace);

		story.stop();
	});

	it("supports exact trace matching and clones snapshot output", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const story = component.record("exact trace");
		await story.execute("increment", 2);

		const originalTrace = story.trace();
		const serializedTrace = igniteTest.serializeTrace(originalTrace);

		igniteTest.expectTrace(serializedTrace, serializedTrace, { exact: true });
		const mutatedStateEntry = serializedTrace[1];
		if (mutatedStateEntry.kind !== "state") {
			throw new Error("expected the second trace entry to be state");
		}
		mutatedStateEntry.state = { counter: { count: 999 } };

		expect(story.trace()[1]).toMatchObject({
			kind: "state",
			state: {
				counter: {
					count: 0,
				},
			},
		});
		expect(originalTrace[1]).toMatchObject({
			kind: "state",
			state: {
				counter: {
					count: 0,
				},
			},
		});

		story.stop();
	});

	it("bridges behavior assertions to accessible controls", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const story = component.record("accessible counter");
		const bridge = igniteTest.accessibilityBridge(
			component,
			({
				count,
				increment,
			}: {
				count: number;
				increment: (amount: number) => void;
			}) =>
				jsxs("section", {
					children: [
						jsx("output", {
							role: "status",
							"aria-label": "Counter status",
							children: String(count),
						}),
						jsx("button", {
							type: "button",
							onClick: () => increment(1),
							children: "Increment",
						}),
					],
				}),
			{ elementName: "counter-accessibility-bridge" },
		);

		await story.execute("increment", 3);

		expect(
			igniteTest.expectControls(bridge, [
				{
					role: "status",
					name: "Counter status",
					text: "3",
				},
				{
					role: "button",
					name: "Increment",
				},
			]),
		).toHaveLength(2);
		expect(story.trace().map((entry) => entry.kind)).toEqual([
			"command",
			"state",
			"view",
			"state",
			"view",
		]);
		expect(story.lifecycle().map((entry) => entry.elementName)).toContain(
			"counter-accessibility-bridge",
		);

		bridge.stop();
		story.stop();
	});

	it("normalizes story summary snapshots with schema-safe values", () => {
		type CircularPayload = {
			count: bigint;
			self?: unknown;
		};
		type CircularEvents = {
			"counter-incremented": EventDescriptor<CircularPayload>;
		};
		type CircularCommands = {
			noop: () => void;
		};

		const finalState: CircularPayload = { count: BigInt(2) };
		finalState.self = finalState;
		const finalView: CircularPayload = { count: BigInt(3) };
		finalView.self = finalView;
		const payload: CircularPayload = { count: BigInt(4) };
		payload.self = payload;

		const story = {
			name: "schema-safe summary",
			execute: async () => ({
				state: finalState,
				events: [],
			}),
			until: async () => finalView,
			trace: () => [],
			lifecycle: () => [],
			summary: () => ({
				name: "schema-safe summary",
				finalState,
				finalView,
				events: [
					{
						type: "counter-incremented",
						payload,
					},
				],
				commandCount: 1,
				traceCount: 0,
				lifecycleCount: 0,
			}),
			stop: () => undefined,
		} as IgniteStory<
			CircularPayload,
			CircularCommands,
			CircularEvents,
			CircularPayload
		>;

		expect(() => igniteTest.snapshotStory(story)).not.toThrow();
		expect(igniteTest.snapshotStory(story).summary).toEqual({
			name: "schema-safe summary",
			finalState: {
				count: "2",
				self: "[Circular]",
			},
			finalView: {
				count: "3",
				self: "[Circular]",
			},
			events: [
				{
					type: "counter-incremented",
					payload: {
						count: "4",
						self: "[Circular]",
					},
				},
			],
			commandCount: 1,
			traceCount: 0,
			lifecycleCount: 0,
		});
	});

	it("matches label-based control names and removes the bridge host on stop", async () => {
		const machine = createMachine({
			context: {
				limit: 3,
			},
			initial: "ready",
			states: {
				ready: {
					on: {
						SET_LIMIT: {
							actions: assign({
								limit: ({ event }) =>
									event.type === "SET_LIMIT" ? event.limit : 3,
							}),
						},
					},
				},
			},
		});
		const component = igniteCore({
			adapter: "xstate",
			source: machine,
			view: ({ snapshot }) => ({
				limit: snapshot.context.limit,
			}),
			commands: ({ actor }) => ({
				setLimit: (limit: number) => actor.send({ type: "SET_LIMIT", limit }),
			}),
		});

		const story = component.record("bridge labels");
		const bridge = igniteTest.accessibilityBridge(
			component,
			({ limit }: { limit: number }) =>
				jsx("label", {
					children: [
						"Limit",
						jsx("input", {
							type: "range",
							min: 3,
							max: 12,
							value: String(limit),
						}),
					],
				}),
			{ elementName: "labelled-range-bridge" },
		);

		await story.execute("setLimit", 6);

		expect(
			igniteTest.expectControls(bridge, [
				{
					role: "slider",
					name: "Limit",
					value: "6",
				},
			]),
		).toHaveLength(1);
		expect(document.body.contains(bridge.host)).toBe(true);

		bridge.stop();

		expect(document.body.contains(bridge.host)).toBe(false);
		story.stop();
	});

	it("reports missing workflow checkpoints with serialized trace context", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const story = component.record("missing checkpoint");
		await story.execute("increment", 1);

		expect(() =>
			igniteTest.expectTrace(story.trace(), [
				{ kind: "event", event: "counter-decremented" },
			]),
		).toThrowErrorMatchingInlineSnapshot(`
			[Error: [igniteTest] Trace expectation not found.
			Expected: {
			  "kind": "event",
			  "event": "counter-decremented"
			}
			Trace: [
			  {
			    "sequence": 1,
			    "kind": "command",
			    "step": 1,
			    "command": "increment",
			    "payload": 1
			  },
			  {
			    "sequence": 2,
			    "kind": "state",
			    "step": 1,
			    "phase": "before",
			    "state": {
			      "counter": {
			        "count": 0
			      }
			    }
			  },
			  {
			    "sequence": 3,
			    "kind": "view",
			    "step": 1,
			    "phase": "before",
			    "view": {}
			  },
			  {
			    "sequence": 4,
			    "kind": "state",
			    "step": 1,
			    "phase": "after",
			    "state": {
			      "counter": {
			        "count": 1
			      }
			    }
			  },
			  {
			    "sequence": 5,
			    "kind": "view",
			    "step": 1,
			    "phase": "after",
			    "view": {}
			  }
			]]
		`);

		story.stop();
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

	it("rejects accessibility bridges for non-Ignite runtimes", () => {
		expect(() =>
			igniteTest.accessibilityBridge(
				{
					async execute() {
						return {
							state: {},
							events: [],
						};
					},
					getSnapshot() {
						return {};
					},
				},
				() => null,
			),
		).toThrow(
			"[igniteTest] DOM accessibility bridge is only available on Ignite component runtimes.",
		);
	});
});
