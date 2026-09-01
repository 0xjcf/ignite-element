import { describe, expect, it, vi } from "vitest";
import { assign, createMachine, type StateFrom, setup } from "xstate";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig, XStateConfig } from "../igniteCore/types";
import type {
	EmptyEventMap,
	EventDescriptor,
	FacadeCommandResult,
	FacadeEffectArgs,
} from "../RenderArgs";
import { jsx, jsxs } from "../renderers/jsx/jsx-runtime";
import { igniteRuntimeHostOverrideSymbol } from "../runtime/agent";
import { test as igniteTest } from "../testing";
import type { IgniteAgentRuntime, IgniteStory } from "../types/agent";
import counterStore, { counterSlice } from "./fixtures/reduxCounterStore";

const settleOnNextMacrotask = () =>
	new Promise<{ status: "pending" }>((resolve) => {
		setTimeout(() => resolve({ status: "pending" }), 0);
	});

const observePromptSettlement = async (promise: Promise<unknown>) =>
	Promise.race([
		promise.then(
			() => ({ status: "resolved" as const }),
			(error) => ({ status: "rejected" as const, error }),
		),
		settleOnNextMacrotask(),
	]);

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
			states: (snapshot) => ({
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

				emit({
					type: "toggled",
					isOn: isOn.current,
				});
			},
		} satisfies XStateConfig<typeof machine, ToggleEventMap>;
		const component = igniteCore(componentConfig);

		(
			await igniteTest({ component })
				.given({ value: "off" })
				.when({ command: "toggle" })
		)
			.expectSnapshot({ value: "on" })
			.expectEvent({ type: "toggled", isOn: true });
	});

	it("asserts nullable command-result snapshots without falling back", async () => {
		type Commands = {
			noop: () => unknown;
		};
		const runtime = {
			execute: async () => ({
				snapshot: null,
				events: [],
			}),
			getSnapshot: () => ({ fallback: true }),
			getStates: () => ({}),
			canExecute: () => true,
			on: () => ({ unsubscribe() {} }),
			watchSnapshot: () => ({ unsubscribe() {} }),
			watchStates: () => ({ unsubscribe() {} }),
		} as unknown as IgniteAgentRuntime<
			null,
			Commands,
			EmptyEventMap,
			unknown,
			Record<string, never>
		>;

		const scenario = await igniteTest({ component: runtime }).when({
			command: "noop",
		});

		expect(() => scenario.expectSnapshot(null)).not.toThrow();
	});

	it("asserts the projected states with expectStates (object, predicate, mismatch)", async () => {
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
			states: (snapshot) => ({
				isOn: snapshot.matches("on"),
				label: "Power",
			}),
			commands: ({ actor }) => ({
				toggle: () => actor.send({ type: "TOGGLE" }),
			}),
		});

		const scenario = await igniteTest({ component })
			.given({ value: "off" })
			.when({ command: "toggle" });

		scenario
			// partial-object match against the projected states
			.expectStates({ isOn: true, label: "Power" })
			// predicate form over the typed projected states — `states.label.startsWith`
			// only compiles when the projection's keys carry their value types
			// (string), proving expectStates sees the projection, not `unknown`.
			.expectStates(
				(states) => states.isOn === true && states.label.startsWith("Power"),
			);

		expect(() => scenario.expectStates({ isOn: false })).toThrow(
			/expectStates failed/,
		);
	});

	it("passes a supplied host to headless scenario commands and effects", async () => {
		const machine = setup({
			types: {
				context: {} as { startedModule: string; lastStartedModule: string },
				events: {} as { type: "START_MODULE"; moduleId: string },
			},
			actions: {
				rememberStartedModule: assign(({ context, event }) => ({
					startedModule:
						event.type === "START_MODULE"
							? event.moduleId
							: context.startedModule,
					lastStartedModule:
						event.type === "START_MODULE"
							? event.moduleId
							: context.lastStartedModule,
				})),
			},
		}).createMachine({
			context: { startedModule: "", lastStartedModule: "" },
			on: {
				START_MODULE: { actions: "rememberStartedModule" },
			},
		});
		type ModuleSnapshot = StateFrom<typeof machine>;
		type ModuleEventMap = {
			"module-started": EventDescriptor<{ moduleId: string }>;
		};

		const host = document.createElement("section");
		host.dataset.moduleId = "dispatch";

		const component = igniteCore({
			adapter: "xstate",
			source: machine,
			states: (snapshot) => ({
				moduleId: snapshot.context.startedModule,
				lastStartedModule: snapshot.context.lastStartedModule,
			}),
			commands: ({ actor, command }) => ({
				startModule: command((moduleId: string) =>
					actor.send({
						type: "START_MODULE",
						moduleId,
					}),
				),
			}),
			events: (event) => ({
				"module-started": event<{ moduleId: string }>(),
			}),
			effects: ({
				snapshot,
				prevSnapshot,
				emit,
			}: FacadeEffectArgs<ModuleSnapshot, unknown, ModuleEventMap>) => {
				if (
					snapshot.context.startedModule === prevSnapshot.context.startedModule
				) {
					return;
				}

				emit({
					type: "module-started",
					moduleId: snapshot.context.startedModule,
				});
			},
		} satisfies XStateConfig<typeof machine, ModuleEventMap>);

		const scenario = await igniteTest({ component, host }).when({
			command: "startModule",
			input: "dispatch",
		});

		scenario
			.expectSnapshot({ context: { startedModule: "dispatch" } })
			.expectStates({
				moduleId: "dispatch",
				lastStartedModule: "dispatch",
			})
			.expectEvent({ type: "module-started", moduleId: "dispatch" });
	});

	it("uses a supplied host for scenario state and states reads", () => {
		const defaultHost = document.createElement("section");
		defaultHost.dataset.hostId = "default";
		const host = document.createElement("section");
		host.dataset.hostId = "supplied";
		let activeHost = defaultHost;
		type HostState = { hostId: string };
		const runtime: IgniteAgentRuntime<
			HostState,
			FacadeCommandResult,
			EmptyEventMap,
			HostState,
			HostState
		> & {
			[igniteRuntimeHostOverrideSymbol]: <Result>(
				nextHost: EventTarget,
				callback: () => Result,
			) => Result;
		} = {
			canExecute: () => false,
			async execute() {
				return {
					snapshot: this.getSnapshot(),
					states: this.getStates(),
					events: [],
				};
			},
			getSnapshot: () => ({ hostId: activeHost.dataset.hostId ?? "missing" }),
			getStates: () => ({ hostId: activeHost.dataset.hostId ?? "missing" }),
			on: () => ({ unsubscribe: () => {} }),
			watchSnapshot: () => ({ unsubscribe: () => {} }),
			watchStates: () => ({ unsubscribe: () => {} }),
			getSchema: () => ({
				commands: {},
				events: [],
				snapshot: { hostId: activeHost.dataset.hostId ?? "missing" },
				states: { hostId: activeHost.dataset.hostId ?? "missing" },
			}),
			record: () => {
				throw new Error("record is not used by this test");
			},
			[igniteRuntimeHostOverrideSymbol]<Result>(
				nextHost: EventTarget,
				callback: () => Result,
			): Result {
				const previousHost = activeHost;
				activeHost = nextHost as HTMLElement;
				try {
					return callback();
				} finally {
					activeHost = previousHost;
				}
			},
		};

		igniteTest({ component: runtime, host })
			.given({ hostId: "supplied" })
			.expectSnapshot({ hostId: "supplied" })
			.expectStates({ hostId: "supplied" });
	});

	it("restores the baseline runtime host after overlapping host-scoped commands", async () => {
		const machine = setup({
			types: {
				context: {} as { hostId: string },
				events: {} as { type: "CAPTURE_HOST"; hostId: string },
			},
			actions: {
				rememberHost: assign(({ event }) => ({
					hostId: event.type === "CAPTURE_HOST" ? event.hostId : "unknown",
				})),
			},
		}).createMachine({
			context: { hostId: "" },
			on: {
				CAPTURE_HOST: { actions: "rememberHost" },
			},
		});

		const seenHostIds: string[] = [];
		const component = igniteCore({
			adapter: "xstate",
			source: machine,
			commands: ({ actor, command }) => ({
				captureHost: command(
					async ({
						hostId,
						delayMs,
					}: {
						hostId?: string;
						delayMs?: number;
					}) => {
						await new Promise((resolve) => setTimeout(resolve, delayMs ?? 0));
						const resolvedHostId = hostId ?? "none";
						seenHostIds.push(resolvedHostId);
						actor.send({
							type: "CAPTURE_HOST",
							hostId: resolvedHostId,
						});
					},
				),
			}),
		});

		const hostA = document.createElement("section");
		hostA.dataset.hostId = "a";
		hostA.dataset.delayMs = "0";
		const hostB = document.createElement("section");
		hostB.dataset.hostId = "b";
		hostB.dataset.delayMs = "20";

		const firstCommand = igniteTest({ component, host: hostA }).when({
			command: "captureHost",
			input: { hostId: "a", delayMs: 0 },
		});
		const secondCommand = igniteTest({ component, host: hostB }).when({
			command: "captureHost",
			input: { hostId: "b", delayMs: 20 },
		});

		await Promise.all([firstCommand, secondCommand]);
		expect([...seenHostIds].sort()).toEqual(["a", "b"]);
		await igniteTest({ component }).when({
			command: "captureHost",
			input: { hostId: "none" },
		});

		expect(component.getSnapshot().context.hostId).toBe("none");
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
			Record<never, never>,
			{
				increment: (amount: number) => unknown;
			}
		>;
		const component = igniteCore(componentConfig);

		const result = (
			await igniteTest({ component })
				.given({ counter: { count: 0 } })
				.when({ command: "increment", input: 2 })
		)
			.expectSnapshot({ counter: { count: 2 } })
			.expectEvents([
				{
					type: "counter-incremented",
					count: 2,
				},
			])
			.getResult();

		expect(result.snapshot.counter.count).toBe(2);
		expect(result.events).toEqual([
			{
				type: "counter-incremented",
				count: 2,
			},
		]);
	});

	it("matches later same-type events when the first event payload differs", async () => {
		const store = counterStore();
		const component = igniteCore({
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

				emit({
					type: "counter-incremented",
					count: snapshot.counter.count - 1,
				});
				emit({
					type: "counter-incremented",
					count: snapshot.counter.count,
				});
			},
		});

		(
			await igniteTest({ component }).when({ command: "increment", input: 2 })
		).expectEvent({
			type: "counter-incremented",
			count: 2,
		});
	});

	it("requires distinct emitted events for repeated expectEvents entries", async () => {
		const store = counterStore();
		const component = igniteCore({
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

				emit({
					type: "counter-incremented",
					count: snapshot.counter.count,
				});
			},
		});
		const scenario = await igniteTest({ component }).when({
			command: "increment",
			input: 2,
		});

		expect(() =>
			scenario.expectEvents([
				{ type: "counter-incremented", count: 2 },
				{ type: "counter-incremented", count: 2 },
			]),
		).toThrow("[igniteTest] Expected event");
	});

	it("uses snapshot vocabulary for scenario results, schemas, and stories", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const scenario = await igniteTest({ component }).when({
			command: "increment",
			input: 1,
		});
		const result = scenario
			.expectSnapshot({ counter: { count: 1 } })
			.getResult();

		expect(result.snapshot.counter.count).toBe(1);
		expect(component.getSchema().snapshot).toEqual({
			counter: { count: 1 },
		});

		const story = component.record("snapshot vocabulary");
		await story.execute({ command: "increment", input: 2 });

		expect(story.summary().finalSnapshot.counter.count).toBe(3);
		expect(story.trace()).toContainEqual(
			expect.objectContaining({
				kind: "snapshot",
				phase: "after",
				snapshot: { counter: { count: 3 } },
			}),
		);
	});

	it("preserves top-level scenario snapshot predicates for given and expectSnapshot", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const scenario = await igniteTest({ component })
			.given((snapshot) => snapshot.counter.count === 0)
			.when({ command: "increment", input: 2 });

		expect(() =>
			scenario.expectSnapshot((snapshot) => snapshot.counter.count === 2),
		).not.toThrow();
	});

	it("rejects story snapshot predicates with a use-when diagnostic", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});
		const weaklyTypedStorySnapshot = {
			counter: {
				count: ((count: number) => count > 0) as unknown,
			},
		} as unknown as { counter: { count: number } };

		await expect(
			igniteTest({ component }).story(
				"reject invalid story snapshot",
				async (narrative) => {
					await narrative.given({
						snapshot: weaklyTypedStorySnapshot,
					});
				},
			),
		).rejects.toThrow(
			"[igniteTest] snapshot.counter.count must be structural data. Move predicate assertions to when.",
		);
	});

	it("reads command availability with canExecute", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
				decrement: command(
					() => actor.dispatch(counterSlice.actions.decrement()),
					{
						canExecute: ({ snapshot }) => snapshot.counter.count > 0,
					},
				),
			}),
		});
		const scenario = igniteTest({ component });
		const story = component.record("availability");

		expect(scenario.canExecute("increment")).toBe(true);
		expect(scenario.canExecute("decrement")).toBe(false);
		expect(story.canExecute("decrement")).toBe(false);

		await scenario.when({ command: "increment", input: 2 });
		expect(scenario.canExecute("decrement")).toBe(true);
		expect(story.canExecute("decrement")).toBe(true);
		story.stop();
	});

	it("forwards object-form command steps and omits input for no-arg commands", async () => {
		const execute = vi
			.fn<
				(call: { command: string; input?: unknown }) => Promise<{
					snapshot: { count: number };
					events: [];
				}>
			>()
			.mockResolvedValue({
				snapshot: { count: 1 },
				events: [],
			});
		const runtime = {
			execute,
			getSnapshot: () => ({ count: 0 }),
			getStates: () => ({ count: 0 }),
			canExecute: () => true,
			on: () => ({ unsubscribe() {} }),
			watchSnapshot: () => ({ unsubscribe() {} }),
			watchStates: () => ({ unsubscribe() {} }),
		} as unknown as IgniteAgentRuntime<
			{ count: number },
			{
				increment: (amount: number) => unknown;
				decrement: () => unknown;
				maybeIncrement: (amount?: number) => unknown;
			},
			EmptyEventMap,
			unknown,
			{ count: number }
		>;

		await igniteTest({ component: runtime }).when({
			command: "increment",
			input: 2,
		});
		await igniteTest({ component: runtime }).when({ command: "decrement" });
		await igniteTest({ component: runtime }).when({
			command: "maybeIncrement",
		});
		await igniteTest({ component: runtime }).when({
			command: "maybeIncrement",
			input: 3,
		});

		expect(execute.mock.calls).toEqual([
			[{ command: "increment", input: 2 }],
			[{ command: "decrement" }],
			[{ command: "maybeIncrement" }],
			[{ command: "maybeIncrement", input: 3 }],
		]);
	});

	it("surfaces runtime unknown-command failures for object-form steps", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});
		const dynamicScenario = igniteTest({ component }) as unknown as {
			when(step: { command: string; input?: unknown }): Promise<unknown>;
		};

		await expect(dynamicScenario.when({ command: "missing" })).rejects.toThrow(
			'[igniteCore] Unknown command "missing".',
		);
	});

	it("runs a named multi-step narrative over story evidence and returns a story snapshot", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
				canDecrement: snapshot.counter.count > 0,
			}),
			commands: ({ actor, command }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
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
		});

		const storySnapshot = await igniteTest({ component }).story(
			"counter recovery",
			async (narrative) => {
				await narrative.given({
					snapshot: { counter: { count: 0 } },
					states: { count: 0, canDecrement: false },
					canExecute: { decrement: false },
				});

				await narrative.intent({ command: "increment", input: 2 });
				await narrative.checkpoint("after increment", {
					snapshot: { counter: { count: 2 } },
					states: { count: 2, canDecrement: true },
					events: [{ type: "counter-incremented", count: 2 }],
					canExecute: { decrement: true },
				});

				await narrative.behavior("external fact", async () => {
					store.dispatch(counterSlice.actions.addByAmount(1));
				});
				await narrative.checkpoint("after external fact", {
					snapshot: { counter: { count: 3 } },
					states: { count: 3, canDecrement: true },
					canExecute: { decrement: true },
				});

				await narrative.intent({ command: "decrement" });
				await narrative.checkpoint("after decrement", {
					snapshot: { counter: { count: 2 } },
					states: { count: 2, canDecrement: true },
					events: [{ type: "counter-incremented", count: 2 }],
					canExecute: { decrement: true },
				});
			},
		);

		expect(storySnapshot.summary.finalSnapshot).toEqual({
			counter: { count: 2 },
		});
		expect(storySnapshot.summary.commandCount).toBe(2);
		expect(storySnapshot.trace).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "command",
					command: "increment",
					payload: 2,
				}),
				expect.objectContaining({
					kind: "command",
					command: "decrement",
				}),
			]),
		);
	});

	it("reports checkpoint failures with story metadata and serialized story evidence", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
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

				emit({
					type: "counter-incremented",
					count: snapshot.counter.count,
				});
			},
		});

		const rejection = await igniteTest({ component })
			.story("failing counter story", async (narrative) => {
				await narrative.intent({ command: "increment", input: 2 });
				await narrative.checkpoint("after increment", {
					snapshot: { counter: { count: 99 } },
				});
			})
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(rejection).toMatchObject({
			message: expect.stringContaining(
				'[igniteTest] Story "failing counter story" failed.',
			),
			cause: expect.objectContaining({
				message: expect.stringContaining("Expected:"),
			}),
		});
		expect((rejection as Error).message).toContain("Phase: checkpoint");
		expect((rejection as Error).message).toContain(
			"Checkpoint: after increment",
		);
		expect((rejection as Error).message).toContain("Expected:");
		expect((rejection as Error).message).toContain("Received:");
		expect((rejection as Error).message).toContain(
			'"name": "failing counter story"',
		);
		expect((rejection as Error).message).toContain('"command": "increment"');
	});

	it("stops the story on success, checkpoint failure, callback failure, and preserves the primary failure when cleanup also fails", async () => {
		const createRuntime = () => {
			const stop = vi.fn();
			const story = {
				name: "tracked story",
				execute: vi.fn(async () => ({
					snapshot: { count: 1 },
					events: [],
				})),
				trace: vi.fn(() => []),
				lifecycle: vi.fn(() => []),
				summary: vi.fn(() => ({
					name: "tracked story",
					finalSnapshot: { count: 1 },
					finalStates: { count: 1 },
					events: [],
					commandCount: 1,
					traceCount: 0,
					lifecycleCount: 0,
				})),
				canExecute: vi.fn(() => true),
				stop,
			};
			const runtime = {
				execute: vi.fn(async () => ({
					snapshot: { count: 0 },
					events: [],
				})),
				getSnapshot: vi.fn(() => ({ count: 0 })),
				getStates: vi.fn(() => ({ count: 0 })),
				canExecute: vi.fn(() => true),
				on: vi.fn(() => ({ unsubscribe() {} })),
				watchSnapshot: vi.fn(() => ({ unsubscribe() {} })),
				watchStates: vi.fn(() => ({ unsubscribe() {} })),
				record: vi.fn(() => story),
			} as unknown as IgniteAgentRuntime<
				{ count: number },
				{
					increment: (amount: number) => unknown;
				},
				EmptyEventMap,
				unknown,
				{ count: number }
			>;

			return { runtime, story, stop };
		};

		const success = createRuntime();
		await igniteTest({ component: success.runtime }).story(
			"successful story",
			async (narrative) => {
				await narrative.intent({ command: "increment", input: 1 });
			},
		);
		expect(success.stop).toHaveBeenCalledTimes(1);

		const checkpointFailure = createRuntime();
		await expect(
			igniteTest({ component: checkpointFailure.runtime }).story(
				"checkpoint failure story",
				async (narrative) => {
					await narrative.intent({ command: "increment", input: 1 });
					await narrative.checkpoint("mismatch", {
						snapshot: { count: 999 },
					});
				},
			),
		).rejects.toThrow("Expected:");
		expect(checkpointFailure.stop).toHaveBeenCalledTimes(1);

		const callbackFailure = createRuntime();
		await expect(
			igniteTest({ component: callbackFailure.runtime }).story(
				"callback failure story",
				async () => {
					throw new Error("primary callback failure");
				},
			),
		).rejects.toThrow("primary callback failure");
		expect(callbackFailure.stop).toHaveBeenCalledTimes(1);

		const cleanupFailure = createRuntime();
		cleanupFailure.stop.mockImplementation(() => {
			throw new Error("cleanup failure");
		});
		await expect(
			igniteTest({ component: cleanupFailure.runtime }).story(
				"cleanup should not mask callback",
				async () => {
					throw new Error("primary callback failure");
				},
			),
		).rejects.toThrow("primary callback failure");
		expect(cleanupFailure.stop).toHaveBeenCalledTimes(1);
	});

	it("settles promptly and attempts both watcher cleanups when a successful story assertion cleanup fails", async () => {
		const snapshotUnsubscribe = vi.fn(() => {
			throw new Error("snapshot cleanup failure");
		});
		const viewUnsubscribe = vi.fn(() => {
			throw new Error("states cleanup failure");
		});
		const stop = vi.fn();
		const story = {
			name: "tracked story",
			execute: vi.fn(async () => ({
				snapshot: { count: 1 },
				events: [],
			})),
			trace: vi.fn(() => []),
			lifecycle: vi.fn(() => []),
			summary: vi.fn(() => ({
				name: "tracked story",
				finalSnapshot: { count: 0 },
				finalStates: { count: 0 },
				events: [],
				commandCount: 0,
				traceCount: 0,
				lifecycleCount: 0,
			})),
			canExecute: vi.fn(() => true),
			stop,
		};
		const runtime = {
			execute: vi.fn(async () => ({
				snapshot: { count: 0 },
				events: [],
			})),
			getSnapshot: vi.fn(() => ({ count: 0 })),
			getStates: vi.fn(() => ({ count: 0 })),
			canExecute: vi.fn(() => true),
			on: vi.fn(() => ({ unsubscribe() {} })),
			watchSnapshot: vi.fn(() => ({ unsubscribe: snapshotUnsubscribe })),
			watchStates: vi.fn(() => ({ unsubscribe: viewUnsubscribe })),
			record: vi.fn(() => story),
		} as unknown as IgniteAgentRuntime<
			{ count: number },
			{
				increment: (amount: number) => unknown;
			},
			EmptyEventMap,
			unknown,
			{ count: number }
		>;

		const outcome = await observePromptSettlement(
			igniteTest({ component: runtime }).story(
				"cleanup after successful assertion",
				async (narrative) => {
					await narrative.given({
						snapshot: { count: 0 },
						states: { count: 0 },
					});
				},
			),
		);

		expect(outcome).toMatchObject({
			status: "rejected",
			error: expect.objectContaining({
				message: expect.stringContaining("snapshot cleanup failure"),
			}),
		});
		expect(snapshotUnsubscribe).toHaveBeenCalledTimes(1);
		expect(viewUnsubscribe).toHaveBeenCalledTimes(1);
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("preserves timeout diagnostics when watcher cleanup also fails and still attempts both watcher cleanups", async () => {
		const snapshotUnsubscribe = vi.fn(() => {
			throw new Error("snapshot cleanup failure");
		});
		const viewUnsubscribe = vi.fn(() => {
			throw new Error("states cleanup failure");
		});
		const stop = vi.fn();
		const story = {
			name: "tracked story",
			execute: vi.fn(async () => ({
				snapshot: { count: 1 },
				events: [],
			})),
			trace: vi.fn(() => []),
			lifecycle: vi.fn(() => []),
			summary: vi.fn(() => ({
				name: "tracked story",
				finalSnapshot: { count: 0 },
				finalStates: { count: 0 },
				events: [],
				commandCount: 0,
				traceCount: 0,
				lifecycleCount: 0,
			})),
			canExecute: vi.fn(() => true),
			stop,
		};
		const runtime = {
			execute: vi.fn(async () => ({
				snapshot: { count: 0 },
				events: [],
			})),
			getSnapshot: vi.fn(() => ({ count: 0 })),
			getStates: vi.fn(() => ({ count: 0 })),
			canExecute: vi.fn(() => true),
			on: vi.fn(() => ({ unsubscribe() {} })),
			watchSnapshot: vi.fn(() => ({ unsubscribe: snapshotUnsubscribe })),
			watchStates: vi.fn(() => ({ unsubscribe: viewUnsubscribe })),
			record: vi.fn(() => story),
		} as unknown as IgniteAgentRuntime<
			{ count: number },
			{
				increment: (amount: number) => unknown;
			},
			EmptyEventMap,
			unknown,
			{ count: number }
		>;
		const driver = igniteTest({
			component: runtime,
		});
		(
			driver as typeof driver & { storyAssertionTimeoutMs: number }
		).storyAssertionTimeoutMs = 1;

		const outcome = await observePromptSettlement(
			driver.story("timeout stays primary", async (narrative) => {
				await narrative.given({
					snapshot: { count: 1 },
				});
			}),
		);

		expect(outcome).toMatchObject({
			status: "rejected",
			error: expect.objectContaining({
				message: expect.stringContaining("given timed out after 1ms"),
			}),
		});
		expect(snapshotUnsubscribe).toHaveBeenCalledTimes(1);
		expect(viewUnsubscribe).toHaveBeenCalledTimes(1);
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("preserves watch setup failures after cleaning up partial watcher subscriptions", async () => {
		const snapshotUnsubscribe = vi.fn(() => {
			throw new Error("snapshot cleanup failure");
		});
		const stop = vi.fn();
		const story = {
			name: "tracked story",
			execute: vi.fn(async () => ({
				snapshot: { count: 1 },
				events: [],
			})),
			trace: vi.fn(() => []),
			lifecycle: vi.fn(() => []),
			summary: vi.fn(() => ({
				name: "tracked story",
				finalSnapshot: { count: 0 },
				finalStates: { count: 0 },
				events: [],
				commandCount: 0,
				traceCount: 0,
				lifecycleCount: 0,
			})),
			canExecute: vi.fn(() => true),
			stop,
		};
		const runtime = {
			execute: vi.fn(async () => ({
				snapshot: { count: 0 },
				events: [],
			})),
			getSnapshot: vi.fn(() => ({ count: 0 })),
			getStates: vi.fn(() => ({ count: 0 })),
			canExecute: vi.fn(() => true),
			on: vi.fn(() => ({ unsubscribe() {} })),
			watchSnapshot: vi.fn(() => ({ unsubscribe: snapshotUnsubscribe })),
			watchStates: vi.fn(() => {
				throw new Error("states watcher setup failed");
			}),
			record: vi.fn(() => story),
		} as unknown as IgniteAgentRuntime<
			{ count: number },
			{
				increment: (amount: number) => unknown;
			},
			EmptyEventMap,
			unknown,
			{ count: number }
		>;

		await expect(
			igniteTest({ component: runtime }).story(
				"cleanup after partial watcher setup",
				async (narrative) => {
					await narrative.given({
						snapshot: { count: 0 },
					});
				},
			),
		).rejects.toThrow("states watcher setup failed");
		expect(snapshotUnsubscribe).toHaveBeenCalledTimes(1);
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("serializes story traces and matches ordered workflow checkpoints", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
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
				isEven: boolean;
			},
			{
				increment: (amount: number) => unknown;
			}
		>);

		const story = component.record("counter story");
		await story.execute({ command: "increment", input: 2 });
		await story.execute({ command: "increment", input: 1 });

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
			        "count": 2,
			        "type": "counter-incremented",
			      },
			      {
			        "count": 3,
			        "type": "counter-incremented",
			      },
			    ],
			    "finalSnapshot": {
			      "counter": {
			        "count": 3,
			      },
			    },
			    "finalStates": {
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
			      "kind": "snapshot",
			      "phase": "before",
			      "sequence": 2,
			      "snapshot": {
			        "counter": {
			          "count": 0,
			        },
			      },
			      "step": 1,
			    },
			    {
			      "kind": "states",
			      "phase": "before",
			      "sequence": 3,
			      "states": {
			        "count": 0,
			        "isEven": true,
			      },
			      "step": 1,
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
			      "kind": "snapshot",
			      "phase": "after",
			      "sequence": 5,
			      "snapshot": {
			        "counter": {
			          "count": 2,
			        },
			      },
			      "step": 1,
			    },
			    {
			      "kind": "states",
			      "phase": "after",
			      "sequence": 6,
			      "states": {
			        "count": 2,
			        "isEven": true,
			      },
			      "step": 1,
			    },
			    {
			      "command": "increment",
			      "kind": "command",
			      "payload": 1,
			      "sequence": 7,
			      "step": 2,
			    },
			    {
			      "kind": "snapshot",
			      "phase": "before",
			      "sequence": 8,
			      "snapshot": {
			        "counter": {
			          "count": 2,
			        },
			      },
			      "step": 2,
			    },
			    {
			      "kind": "states",
			      "phase": "before",
			      "sequence": 9,
			      "states": {
			        "count": 2,
			        "isEven": true,
			      },
			      "step": 2,
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
			      "kind": "snapshot",
			      "phase": "after",
			      "sequence": 11,
			      "snapshot": {
			        "counter": {
			          "count": 3,
			        },
			      },
			      "step": 2,
			    },
			    {
			      "kind": "states",
			      "phase": "after",
			      "sequence": 12,
			      "states": {
			        "count": 3,
			        "isEven": false,
			      },
			      "step": 2,
			    },
			  ],
			}
		`);

		expect(
			igniteTest.expectTrace(trace, [
				{ kind: "command", command: "increment", payload: 2 },
				{ kind: "event", event: "counter-incremented", payload: { count: 2 } },
				(entry) =>
					entry.kind === "states" && entry.phase === "after" && entry.step === 2,
			]),
		).toEqual(trace);

		story.stop();
	});

	it("supports exact trace matching and clones snapshot output", async () => {
		const store = counterStore();
		const component = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const story = component.record("exact trace");
		await story.execute({ command: "increment", input: 2 });

		const originalTrace = story.trace();
		const serializedTrace = igniteTest.serializeTrace(originalTrace);

		igniteTest.expectTrace(serializedTrace, serializedTrace, { exact: true });
		const mutatedSnapshotEntry = serializedTrace[1];
		if (mutatedSnapshotEntry.kind !== "snapshot") {
			throw new Error("expected the second trace entry to be snapshot");
		}
		mutatedSnapshotEntry.snapshot = { counter: { count: 999 } };

		expect(story.trace()[1]).toMatchObject({
			kind: "snapshot",
			snapshot: {
				counter: {
					count: 0,
				},
			},
		});
		expect(originalTrace[1]).toMatchObject({
			kind: "snapshot",
			snapshot: {
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
			states: (snapshot) => ({
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

		await story.execute({ command: "increment", input: 3 });

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
			"snapshot",
			"states",
			"snapshot",
			"states",
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

		const finalSnapshot: CircularPayload = { count: BigInt(2) };
		finalSnapshot.self = finalSnapshot;
		const finalStates: CircularPayload = { count: BigInt(3) };
		finalStates.self = finalStates;
		const payload: CircularPayload = { count: BigInt(4) };
		payload.self = payload;

		const story = {
			name: "schema-safe summary",
			execute: async () => ({
				snapshot: finalSnapshot,
				states: finalStates,
				events: [],
			}),
			behavior: async <Result>(_name: string, operation: () => Result) =>
				operation(),
			until: async () => finalStates,
			trace: () => [],
			lifecycle: () => [],
			summary: () => ({
				name: "schema-safe summary",
				finalSnapshot,
				finalStates,
				events: [
					{
						type: "counter-incremented",
						...payload,
					},
				],
				commandCount: 1,
				traceCount: 0,
				lifecycleCount: 0,
			}),
			canExecute: () => true,
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
			finalSnapshot: {
				count: "2",
				self: "[Circular]",
			},
			finalStates: {
				count: "3",
				self: "[Circular]",
			},
			events: [
				{
					type: "counter-incremented",
					count: "4",
					self: {
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
			states: (snapshot) => ({
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

		await story.execute({ command: "setLimit", input: 6 });

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
		await story.execute({ command: "increment", input: 1 });

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
			    "kind": "snapshot",
			    "step": 1,
			    "phase": "before",
			    "snapshot": {
			      "counter": {
			        "count": 0
			      }
			    }
			  },
			  {
			    "sequence": 3,
			    "kind": "states",
			    "step": 1,
			    "phase": "before",
			    "states": {}
			  },
			  {
			    "sequence": 4,
			    "kind": "snapshot",
			    "step": 1,
			    "phase": "after",
			    "snapshot": {
			      "counter": {
			        "count": 1
			      }
			    }
			  },
			  {
			    "sequence": 5,
			    "kind": "states",
			    "step": 1,
			    "phase": "after",
			    "states": {}
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

		expect(() => igniteTest({ component }).expectNoEvents()).toThrow(
			"[igniteTest] No command has been executed yet. Call when() before asserting execution results.",
		);
	});

	it("rejects accessibility bridges for non-Ignite runtimes", () => {
		expect(() =>
			igniteTest.accessibilityBridge(
				{
					async execute() {
						return {
							snapshot: {},
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
