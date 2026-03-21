import { configureStore } from "@reduxjs/toolkit";
import type { TemplateResult } from "lit-html";
import { html } from "lit-html";
import { makeAutoObservable } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, type EventFrom } from "xstate";
import type { MobxEvent } from "../adapters/MobxAdapter";
import type {
	ExtendedState,
	XStateCommandActor,
} from "../adapters/XStateAdapter";
import counterStore, {
	counterSlice,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type {
	CommandContext,
	EventDescriptor,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../RenderArgs";
import type { InferStateAndEvent } from "../utils/igniteRedux";

// Mock XState machine
const mockXStateMachine = createMachine({
	context: {},
	initial: "idle",
	states: {
		idle: {},
	},
});
// Mock Redux store
const mockReduxStore = () =>
	configureStore({
		reducer: (state = {}) => state,
	});

// Mock Mobx store
const mockMobxStore = () =>
	makeAutoObservable({
		count: 0,
		increment() {
			this.count += 1;
		},
	});

describe("igniteCore", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("should initialize without errors for XState adapter", () => {
		const core = igniteCore({
			adapter: "xstate",
			source: mockXStateMachine,
		});
		expect(core).toBeDefined();
	});

	it("should initialize without errors for Redux adapter", () => {
		const core = igniteCore({
			adapter: "redux",
			source: mockReduxStore,
		});
		expect(core).toBeDefined();
	});

	it("should initialize without errors for Mobx adapter", () => {
		const core = igniteCore({
			adapter: "mobx",
			source: mockMobxStore,
		});
		expect(core).toBeDefined();
	});

	it("infers xstate adapter when omitted", () => {
		const core = igniteCore({
			source: mockXStateMachine,
		});
		expect(core).toBeDefined();
	});

	it("infers redux adapter for store factory when omitted", () => {
		const core = igniteCore({
			source: mockReduxStore,
		});
		expect(core).toBeDefined();
	});

	it("infers redux adapter for store instance when omitted", () => {
		const core = igniteCore({
			source: mockReduxStore(),
		});
		expect(core).toBeDefined();
	});

	it("infers redux adapter for slice when omitted", () => {
		const core = igniteCore({
			source: counterSlice,
		});
		expect(core).toBeDefined();
	});

	it("infers mobx adapter when omitted", () => {
		const sharedStore = mockMobxStore();
		const core = igniteCore({
			source: sharedStore,
		});
		expect(core).toBeDefined();
	});

	it("infers mobx adapter for factories when omitted", () => {
		const core = igniteCore({
			source: mockMobxStore,
		});
		expect(core).toBeDefined();
	});

	it("throws when adapter cannot be inferred", () => {
		expect(() =>
			igniteCore({
				source: {} as unknown,
			} as unknown as Parameters<typeof igniteCore>[0]),
		).toThrow(
			"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
		);
	});

	it("throws when factory inference fails", () => {
		const failingFactory: () => Record<string, never> = () => {
			throw new Error("factory boom");
		};
		expect(() =>
			igniteCore({
				source: failingFactory,
			}),
		).toThrow(
			"[igniteCore] Failed to execute source factory while inferring adapter. Specify the adapter explicitly.",
		);
	});

	it("provides facade callbacks for xstate sources", () => {
		const machine = createMachine({
			context: { count: 0 },
			initial: "idle",
			states: {
				idle: {
					on: {
						INC: {
							actions: assign({ count: ({ context }) => context.count + 1 }),
						},
					},
				},
			},
		});
		type Machine = typeof machine;
		type Snapshot = ExtendedState<Machine>;
		type MachineEvent = EventFrom<Machine>;
		type MachineActor = XStateCommandActor<Machine>;

		const statesCallback = (snapshot: Snapshot) => ({
			double: snapshot.context.count * 2,
		});
		const commandsCallback = ({ actor }: { actor: MachineActor }) => ({
			increment: () => actor.send({ type: "INC" }),
		});

		const register = igniteCore({
			adapter: "xstate",
			source: createActor(machine),
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = {
			state: Snapshot;
			send: (event: MachineEvent) => void;
			double: number;
			increment: () => void;
		};

		const elementName = `xstate-facade-${crypto.randomUUID()}`;
		let latestArgs: RenderArgs | undefined;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>((args) => {
			latestArgs = args;
			return html``;
		});
		register(elementName, renderFn);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(renderFn).toHaveBeenCalledTimes(1);
		expect(latestArgs?.double).toBe(0);
		expect(typeof latestArgs?.increment).toBe("function");

		latestArgs?.increment();

		expect(renderFn).toHaveBeenCalledTimes(2);
		expect(latestArgs?.double).toBe(2);
	});

	it("provides facade callbacks for redux slices", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceEvent = InferStateAndEvent<typeof counterSlice>["Event"];
		type SliceActor = ReduxSliceCommandActor<typeof counterSlice>;

		const statesCallback = (snapshot: SliceState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = ({ actor }: { actor: SliceActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: counterSlice,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = {
			state: SliceState;
			send: (event: SliceEvent) => void;
			count: number;
			increment: () => void;
		};

		const elementName = `redux-slice-facade-${crypto.randomUUID()}`;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>((args) => {
			expect(typeof args.count).toBe("number");
			expect(typeof args.increment).toBe("function");
			return html``;
		});
		register(elementName, renderFn);

		document.body.appendChild(document.createElement(elementName));
		const firstArgs = renderFn.mock.calls.at(-1)?.[0];
		expect(firstArgs).toBeDefined();
		firstArgs?.increment();

		expect(renderFn).toHaveBeenCalledTimes(2);
		const latestArgs = renderFn.mock.calls.at(-1)?.[0];
		expect(latestArgs).toBeDefined();
		expect(latestArgs?.count).toBe(1);
	});

	it("emits declared events from effects after state updates", () => {
		const store = counterStore();
		const dispatchSpy = vi.spyOn(store, "dispatch");
		type EventStoreState = InferStateAndEvent<typeof store>["State"];
		const eventStates = (snapshot: EventStoreState) => ({
			count: snapshot.counter.count,
		});
		type CounterEventMap = {
			"counter-incremented": EventDescriptor<{ amount: number }>;
		};
		const order: string[] = [];
		type EventCommandContext = CommandContext<
			ReduxStoreCommandActor<typeof store>
		>;
		const eventCommands = ({ actor }: EventCommandContext) => ({
			increment: () => {
				order.push("dispatch");
				actor.dispatch(counterSlice.actions.increment());
			},
		});
		const eventEffects = (
			snapshot: EventStoreState,
			prevSnapshot: EventStoreState,
			{
				emit,
				host,
			}: CommandContext<ReduxStoreCommandActor<typeof store>, CounterEventMap>,
		) => {
			if (snapshot.counter.count === prevSnapshot.counter.count) {
				return;
			}

			const amountAttr = host.getAttribute("data-amount");
			const amount = amountAttr ? Number(amountAttr) : 1;
			emit("counter-incremented", { amount });
		};
		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: eventStates,
			events: (event) => ({
				"counter-incremented": event<{ amount: number }>(),
			}),
			commands: eventCommands,
			effects: eventEffects,
		});

		type RenderArgs = {
			increment: () => void;
		};

		const elementName = `redux-event-${crypto.randomUUID()}`;
		let latestArgs: RenderArgs | undefined;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>((args) => {
			latestArgs = args;
			return html``;
		});

		register(elementName, renderFn);
		const element = document.createElement(elementName);
		element.setAttribute("data-amount", "4");
		const isCounterIncrementEvent = (
			event: Event,
		): event is CustomEvent<{ amount: number }> => event instanceof CustomEvent;
		const listener = vi.fn((event: Event) => {
			if (!isCounterIncrementEvent(event)) {
				throw new Error("Unexpected event type");
			}
			order.push("emit");
			expect(event.detail.amount).toBe(4);
		});
		element.addEventListener("counter-incremented", listener);
		document.body.appendChild(element);

		expect(latestArgs).toBeDefined();
		latestArgs?.increment();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(order).toEqual(["dispatch", "emit"]);
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({ type: "counter/increment" }),
		);
	});

	it("warns once when deprecated emit is used inside commands", () => {
		const store = counterStore();
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);

		const register = igniteCore({
			adapter: "redux",
			source: store,
			events: (event) => ({
				"counter-incremented": event<{ amount: number }>(),
			}),
			commands: ({ actor, emit }) => ({
				increment: () => {
					emit("counter-incremented", { amount: 1 });
					actor.dispatch(counterSlice.actions.increment());
				},
			}),
		});

		register.execute("increment");
		register.execute("increment");

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith(
			"emit inside commands is deprecated. Move to effects().",
		);
	});

	it("supports headless command execution and event subscriptions", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
		const runtimeConfig = {
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: (amount = 1) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: (snapshot: StoreState, prevSnapshot: StoreState, { emit }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;
		const register = igniteCore(runtimeConfig);

		const listener = vi.fn((event: CustomEvent<{ count: number }>) => {
			expect(event.detail.count).toBe(3);
		});
		const subscription = register.subscribe("counter-incremented", listener);

		const result = register.execute("increment", 3);

		expect(register.getState().counter.count).toBe(3);
		expect(result.state.counter.count).toBe(3);
		expect(result.events).toEqual([
			{
				type: "counter-incremented",
				payload: { count: 3 },
			},
		]);
		expect(listener).toHaveBeenCalledTimes(1);

		subscription.unsubscribe();
		register.execute("increment", 1);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("shares redux store instances across elements", () => {
		const store = counterStore();
		const dispatchSpy = vi.spyOn(store, "dispatch");
		type StoreInstance = typeof store;
		type StoreState = InferStateAndEvent<StoreInstance>["State"];
		type StoreEvent = InferStateAndEvent<StoreInstance>["Event"];
		type StoreActor = ReduxStoreCommandActor<StoreInstance>;

		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = ({ actor }: { actor: StoreActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = {
			state: StoreState;
			send: (event: StoreEvent) => void;
			count: number;
			increment: () => void;
		};

		const elementName = `redux-store-facade-${crypto.randomUUID()}`;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>(
			(_args) => html``,
		);
		register(elementName, renderFn);

		const firstElement = document.createElement(elementName);
		document.body.appendChild(firstElement);
		const firstArgs = renderFn.mock.calls.at(-1)?.[0];
		expect(firstArgs).toBeDefined();

		const secondElement = document.createElement(elementName);
		document.body.appendChild(secondElement);
		const secondArgs = renderFn.mock.calls.at(-1)?.[0] as
			| RenderArgs
			| undefined;
		expect(secondArgs).toBeDefined();

		expect(firstArgs?.count).toBe(0);
		expect(secondArgs?.count).toBe(0);

		firstArgs?.increment();
		const afterFirst = renderFn.mock.calls.at(-1)?.[0] as
			| RenderArgs
			| undefined;
		expect(afterFirst).toBeDefined();
		expect(afterFirst?.count).toBe(1);
		expect(store.getState().counter.count).toBe(1);

		secondArgs?.increment();
		const afterSecond = renderFn.mock.calls.at(-1)?.[0] as
			| RenderArgs
			| undefined;
		expect(afterSecond).toBeDefined();
		expect(afterSecond?.count).toBe(2);
		expect(store.getState().counter.count).toBe(2);
		expect(dispatchSpy).toHaveBeenCalledTimes(2);
	});

	it("creates isolated mobx stores per element", () => {
		const createStore = () =>
			makeAutoObservable({
				count: 0,
				increment() {
					this.count += 1;
				},
			});

		type StoreState = ReturnType<typeof createStore>;
		type StoreEvent = MobxEvent<StoreState>;

		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.count,
		});
		const commandsCallback = ({
			actor: storeInstance,
		}: {
			actor: StoreState;
		}) => ({
			increment: () => storeInstance.increment(),
		});

		const register = igniteCore({
			adapter: "mobx",
			source: createStore,
			states: statesCallback,
			commands: commandsCallback,
		});

		type RenderArgs = {
			state: StoreState;
			send: (event: StoreEvent) => void;
			count: number;
			increment: () => void;
		};

		const elementName = `mobx-facade-${crypto.randomUUID()}`;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>(
			(_args) => html``,
		);
		register(elementName, renderFn);

		const firstElement = document.createElement(elementName);
		document.body.appendChild(firstElement);
		const firstArgs = renderFn.mock.calls.at(-1)?.[0];
		expect(firstArgs).toBeDefined();

		const secondElement = document.createElement(elementName);
		document.body.appendChild(secondElement);
		const secondArgs = renderFn.mock.calls.at(-1)?.[0] as
			| RenderArgs
			| undefined;
		expect(secondArgs).toBeDefined();

		expect(firstArgs?.increment).not.toBe(secondArgs?.increment);
		expect(firstArgs?.count).toBe(0);
		expect(secondArgs?.count).toBe(0);

		firstArgs?.increment();
		const afterFirst = renderFn.mock.calls.at(-1)?.[0] as
			| RenderArgs
			| undefined;
		expect(afterFirst).toBeDefined();
		expect(afterFirst?.count).toBe(1);
		expect(secondArgs?.count).toBe(0);
	});

	it("should throw an error for unsupported adapters", () => {
		expect(() =>
			igniteCore({
				// @ts-expect-error This error is expected because `unknownAction` is not part of the defined event types.
				adapter: "unsupported",
			}),
		).toThrow("Unsupported adapter: unsupported");
	});
});
