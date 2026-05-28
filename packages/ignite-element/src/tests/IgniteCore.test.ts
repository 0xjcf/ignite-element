import { configureStore } from "@reduxjs/toolkit";
import type { TemplateResult } from "lit-html";
import { html } from "lit-html";
import { makeAutoObservable } from "mobx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, type EventFrom } from "xstate";
import type {
	ActorWebSource,
	ActorWebSourceSnapshot,
	ActorWebTransportStatus,
} from "../actor-web";
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
	FacadeEffectArgs,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../RenderArgs";
import { jsx, jsxs } from "../renderers/jsx/jsx-runtime";
import { toSchemaValue } from "../runtime/schema";
import { test as igniteTest } from "../testing";
import type { InferStateAndEvent } from "../utils/igniteRedux";

type ActorWebShipmentContext = {
	shipmentId: string | null;
	status: "idle" | "created";
};

type ActorWebShipmentCommand =
	| { type: "CREATE_SHIPMENT"; shipmentId: string }
	| { type: "RESET_SHIPMENT" };

function createActorWebShipmentSource(): ActorWebSource<
	ActorWebShipmentContext,
	ActorWebShipmentCommand,
	{ type: "SHIPMENT_CREATED"; shipmentId: string }
> & {
	sent: ActorWebShipmentCommand[];
	emitSnapshot(context: ActorWebShipmentContext): void;
	emitTransport(status: ActorWebTransportStatus): void;
} {
	let context: ActorWebShipmentContext = {
		shipmentId: null,
		status: "idle",
	};
	let transport: ActorWebTransportStatus = {
		state: "connected",
		updatedAt: 1,
	};
	const snapshotListeners = new Set<
		(snapshot: ActorWebSourceSnapshot<ActorWebShipmentContext>) => void
	>();
	const transportListeners = new Set<
		(status: ActorWebTransportStatus) => void
	>();
	const source = {
		sent: [] as ActorWebShipmentCommand[],
		address: {
			id: "logistics-shipment",
			type: "actor",
			path: "actor://server/actor/logistics-shipment",
		},
		snapshot: () => ({
			address: source.address,
			context,
			phase: context.status,
			toJSON: () => ({ context }),
		}),
		subscribe: (
			listener: (
				snapshot: ActorWebSourceSnapshot<ActorWebShipmentContext>,
			) => void,
		) => {
			snapshotListeners.add(listener);
			listener(source.snapshot());
			return () => {
				snapshotListeners.delete(listener);
			};
		},
		transportStatus: () => transport,
		subscribeTransportStatus: (
			listener: (status: ActorWebTransportStatus) => void,
		) => {
			transportListeners.add(listener);
			listener(transport);
			return () => {
				transportListeners.delete(listener);
			};
		},
		send: async (message: ActorWebShipmentCommand) => {
			source.sent.push(message);
		},
		ask: async <Response = unknown>() => 1 as Response,
		emitSnapshot(nextContext: ActorWebShipmentContext) {
			context = nextContext;
			const snapshot = source.snapshot();
			for (const listener of snapshotListeners) {
				listener(snapshot);
			}
		},
		emitTransport(status: ActorWebTransportStatus) {
			transport = status;
			for (const listener of transportListeners) {
				listener(status);
			}
		},
	};
	return source;
}

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

	it("infers actor-web adapter when omitted", () => {
		const core = igniteCore({
			source: createActorWebShipmentSource(),
		});
		expect(core).toBeDefined();
	});

	it("does not execute zero-arg actor-web factories while adapter inference is omitted", () => {
		const sourceFactory = vi.fn(() => createActorWebShipmentSource());

		expect(() =>
			igniteCore({
				source: sourceFactory,
			} as unknown as Parameters<typeof igniteCore>[0]),
		).toThrow(
			"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
		);
		expect(sourceFactory).not.toHaveBeenCalled();
	});

	it("infers actor-web from host-context factories without eager execution", () => {
		let observedFleetId: string | null | undefined;
		let sourceFactoryCalls = 0;
		const sourceFactory: (context: {
			host?: HTMLElement;
		}) => ActorWebSource<
			ActorWebShipmentContext,
			ActorWebShipmentCommand,
			{ type: "SHIPMENT_CREATED"; shipmentId: string }
		> = (context) => {
			sourceFactoryCalls += 1;
			observedFleetId = context.host?.getAttribute("fleet-id");
			return createActorWebShipmentSource();
		};
		const register = igniteCore({
			source: sourceFactory,
			states: ({ context }) => ({
				status: context.status,
			}),
		});
		const elementName = `actor-web-inferred-host-source-${crypto.randomUUID()}`;

		expect(sourceFactoryCalls).toBe(0);
		register(elementName, () => html``);
		expect(sourceFactoryCalls).toBe(0);
		const element = document.createElement(elementName);
		element.setAttribute("fleet-id", "fleet-84");
		document.body.appendChild(element);

		expect(sourceFactoryCalls).toBe(1);
		expect(observedFleetId).toBe("fleet-84");
		element.remove();
	});

	it("does not infer defaulted actor-web host factories without an explicit adapter", () => {
		let observedFleetId: string | null | undefined;
		const sourceFactory = vi.fn((context: { host?: HTMLElement } = {}) => {
			observedFleetId = context.host?.getAttribute("fleet-id");
			return createActorWebShipmentSource();
		});

		expect(sourceFactory.length).toBe(0);
		expect(() =>
			igniteCore({
				source: sourceFactory,
			} as unknown as Parameters<typeof igniteCore>[0]),
		).toThrow(
			"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
		);
		expect(sourceFactory).not.toHaveBeenCalled();

		const register = igniteCore({
			adapter: "actor-web",
			source: sourceFactory,
			states: ({ context }) => ({
				status: context.status,
			}),
		});
		const elementName = `actor-web-defaulted-host-source-${crypto.randomUUID()}`;

		expect(sourceFactory).not.toHaveBeenCalled();
		register(elementName, () => html``);
		expect(sourceFactory).not.toHaveBeenCalled();
		const element = document.createElement(elementName);
		element.setAttribute("fleet-id", "fleet-defaulted");
		document.body.appendChild(element);

		expect(sourceFactory).toHaveBeenCalledTimes(1);
		expect(observedFleetId).toBe("fleet-defaulted");
		element.remove();
	});

	it("keeps explicit actor-web factories lazy until connect and provides host context", () => {
		const sourceFactory = vi.fn(
			(context: { host?: HTMLElement } | undefined) => {
				observedFleetId = context?.host?.getAttribute("fleet-id");
				return createActorWebShipmentSource();
			},
		);
		let observedFleetId: string | null | undefined;
		const register = igniteCore({
			adapter: "actor-web",
			source: sourceFactory,
			states: ({ context }) => ({
				status: context.status,
			}),
		});
		const elementName = `actor-web-host-source-${crypto.randomUUID()}`;

		expect(sourceFactory).not.toHaveBeenCalled();
		register(elementName, () => html``);
		expect(sourceFactory).not.toHaveBeenCalled();
		const element = document.createElement(elementName);
		element.setAttribute("fleet-id", "fleet-42");
		document.body.appendChild(element);

		expect(sourceFactory).toHaveBeenCalledTimes(1);
		expect(observedFleetId).toBe("fleet-42");
		element.remove();
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

	it("fails closed for zero-arg factories when adapter inference is omitted", () => {
		const failingFactory: () => Record<string, never> = () => {
			throw new Error("factory boom");
		};
		expect(() =>
			igniteCore({
				source: failingFactory,
			} as unknown as Parameters<typeof igniteCore>[0]),
		).toThrow(
			"[igniteCore] Unable to infer adapter from source. Please specify the adapter explicitly.",
		);
	});

	it("projects actor-web source context, transport, and commands", () => {
		const source = createActorWebShipmentSource();
		const register = igniteCore({
			source,
			states: ({ context, transport }) => ({
				status: context.status,
				shipmentId: context.shipmentId,
				connected: transport.state === "connected",
			}),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
				reset: () => actor.send({ type: "RESET_SHIPMENT" }),
			}),
		});

		expect(register.getState().context.status).toBe("idle");
		expect(register.getView()).toEqual({
			status: "idle",
			shipmentId: null,
			connected: true,
		});

		register.execute("createShipment", "shipment-1001");
		expect(source.sent).toEqual([
			{ type: "CREATE_SHIPMENT", shipmentId: "shipment-1001" },
		]);

		source.emitSnapshot({
			shipmentId: "shipment-1001",
			status: "created",
		});
		source.emitTransport({
			state: "degraded",
			updatedAt: 2,
			reason: "gateway disconnected",
		});

		expect(register.getState()).toMatchObject({
			context: {
				shipmentId: "shipment-1001",
				status: "created",
			},
			transport: {
				state: "degraded",
				reason: "gateway disconnected",
			},
		});
		expect(register.getView()).toEqual({
			status: "created",
			shipmentId: "shipment-1001",
			connected: false,
		});
	});

	it("provides projected view callbacks for xstate sources", () => {
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

		const viewCallback = ({ snapshot }: { snapshot: Snapshot }) => ({
			double: snapshot.context.count * 2,
		});
		const commandsCallback = ({ actor }: { actor: MachineActor }) => ({
			increment: () => actor.send({ type: "INC" }),
		});

		const register = igniteCore({
			adapter: "xstate",
			source: createActor(machine),
			view: viewCallback,
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
			count: snapshot.count,
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
		const firstArgs = renderFn.mock.calls[renderFn.mock.calls.length - 1]?.[0];
		expect(firstArgs).toBeDefined();
		firstArgs?.increment();

		expect(renderFn).toHaveBeenCalledTimes(2);
		const latestArgs = renderFn.mock.calls[renderFn.mock.calls.length - 1]?.[0];
		expect(latestArgs).toBeDefined();
		expect(latestArgs?.count).toBe(1);
	});

	it("emits declared events from effects after state updates", async () => {
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
		const eventEffects = ({
			snapshot,
			prevSnapshot,
			emit,
			host,
		}: FacadeEffectArgs<
			EventStoreState,
			ReduxStoreCommandActor<typeof store>,
			CounterEventMap,
			HTMLElement
		>) => {
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

		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(listener).toHaveBeenCalledTimes(1);
		expect(order).toEqual(["dispatch", "emit"]);
		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({ type: "counter/increment" }),
		);
	});

	it("seeds effects from the current snapshot instead of replaying on attach", async () => {
		const store = counterStore();
		store.dispatch(counterSlice.actions.addByAmount(2));
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
		const runtimeConfig = {
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({ snapshot, emit }) => {
				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;
		const register = igniteCore(runtimeConfig);

		type RenderArgs = {
			count: number;
			increment: () => void;
		};

		const elementName = `redux-effect-seed-${crypto.randomUUID()}`;
		let latestArgs: RenderArgs | undefined;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>((args) => {
			latestArgs = args;
			return html``;
		});

		register(elementName, renderFn);

		const element = document.createElement(elementName);
		const listener = vi.fn((event: Event) => {
			const customEvent = event as CustomEvent<{ count: number }>;
			expect(customEvent.detail.count).toBe(3);
		});
		element.addEventListener("counter-incremented", listener);
		document.body.appendChild(element);

		expect(latestArgs?.count).toBe(2);
		expect(listener).not.toHaveBeenCalled();

		latestArgs?.increment();

		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("runs effects after render via microtask after a state update", async () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
		const order: string[] = [];

		const runtimeConfig = {
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: () => {
					order.push("dispatch");
					actor.dispatch(counterSlice.actions.increment());
				},
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({ snapshot, prevSnapshot, emit }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				order.push("effect");
				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;
		const register = igniteCore(runtimeConfig);

		type RenderArgs = {
			count: number;
			increment: () => void;
		};

		const elementName = `redux-effect-order-${crypto.randomUUID()}`;
		let latestArgs: RenderArgs | undefined;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>((args) => {
			latestArgs = args;
			if (args.count > 0) {
				order.push("render");
			}
			return html``;
		});

		register(elementName, renderFn);

		const element = document.createElement(elementName);
		element.addEventListener("counter-incremented", () => {
			order.push("emit");
		});
		document.body.appendChild(element);

		order.length = 0;
		latestArgs?.increment();

		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(order).toEqual(["dispatch", "render", "effect", "emit"]);
	});

	it("reports queued effect errors without failing command execution", async () => {
		const store = counterStore();
		const effectError = new Error("effect failed");
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
			effects: ({ snapshot, prevSnapshot }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				throw effectError;
			},
		});

		const result = await register.execute("increment");

		expect(result.state.counter.count).toBe(1);
		expect(consoleError).toHaveBeenCalledWith(
			"[igniteCore] Effect callback failed.",
			effectError,
		);
	});

	it("supports headless command execution, projected views, event listeners, and watchers", async () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type StoreView = {
			count: number;
			isEven: boolean;
		};
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
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

				emit("counter-incremented", {
					count: count.current,
				});
			},
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>;
		const register = igniteCore(runtimeConfig);

		const listener = vi.fn((event: CustomEvent<{ count: number }>) => {
			expect(event.detail.count).toBe(3);
		});
		const watchListener = vi.fn((state: StoreState, prevState: StoreState) => {
			expect(prevState.counter.count).toBe(0);
			expect(state.counter.count).toBe(3);
		});
		const watchViewListener = vi.fn((view: StoreView, prevView: StoreView) => {
			expect(prevView).toEqual({ count: 0, isEven: true });
			expect(view).toEqual({ count: 3, isEven: false });
		});
		const eventSubscription = register.on("counter-incremented", listener);
		const stateSubscription = register.watch(watchListener);
		const viewSubscription = register.watchView(watchViewListener);

		const result = await register.execute("increment", 3);

		expect(register.getState().counter.count).toBe(3);
		expect(register.getView()).toEqual({ count: 3, isEven: false });
		expect(result.state.counter.count).toBe(3);
		expect(result.events).toEqual([
			{
				type: "counter-incremented",
				payload: { count: 3 },
			},
		]);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(watchListener).toHaveBeenCalledTimes(1);
		expect(watchViewListener).toHaveBeenCalledTimes(1);

		eventSubscription.unsubscribe();
		stateSubscription.unsubscribe();
		viewSubscription.unsubscribe();
		await register.execute("increment", 1);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(watchListener).toHaveBeenCalledTimes(1);
		expect(watchViewListener).toHaveBeenCalledTimes(1);
	});

	it("rejects failed commands and removes event listeners", async () => {
		const store = counterStore();
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
		const removeListener = vi.spyOn(
			EventTarget.prototype,
			"removeEventListener",
		);

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor }) => ({
				failSync: () => {
					throw new Error("sync failed");
				},
				failAsync: async () => {
					throw new Error("async failed");
				},
				increment: () => actor.dispatch(counterSlice.actions.increment()),
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
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>);

		await expect(register.execute("failSync")).rejects.toThrow("sync failed");
		await expect(register.execute("failAsync")).rejects.toThrow("async failed");

		expect(removeListener).toHaveBeenCalledWith(
			"counter-incremented",
			expect.any(Function),
		);

		const result = await register.execute("increment");

		expect(result.events).toEqual([
			{
				type: "counter-incremented",
				payload: { count: 1 },
			},
		]);
	});

	it("records behavior-first stories with traces, until guards, and summaries", async () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type StoreView = {
			count: number;
			isEven: boolean;
		};
		type RuntimeEventMap = {
			"counter-incremented": EventDescriptor<{ count: number }>;
		};
		const register = igniteCore({
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
			effects: ({ snapshot, prevSnapshot, emit }) => {
				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit("counter-incremented", {
					count: snapshot.counter.count,
				});
			},
		} satisfies ReduxInstanceConfig<typeof store, RuntimeEventMap>);

		const story = register.record("counter reaches five");
		await story.execute("increment", 2);
		const finalView = await story.until(
			(view) => view.count >= 5,
			async () => {
				await story.execute("increment", 1);
			},
			{ maxSteps: 5 },
		);

		expect(finalView).toEqual({ count: 5, isEven: false });
		expect(story.trace().map((entry) => entry.kind)).toEqual([
			"command",
			"state",
			"view",
			"event",
			"state",
			"view",
			"command",
			"state",
			"view",
			"event",
			"state",
			"view",
			"command",
			"state",
			"view",
			"event",
			"state",
			"view",
			"command",
			"state",
			"view",
			"event",
			"state",
			"view",
		]);
		expect(
			story
				.trace()
				.filter((entry) => entry.kind === "command")
				.map((entry) => entry.command),
		).toEqual(["increment", "increment", "increment", "increment"]);

		const summary = story.summary();
		expect(summary.finalState.counter.count).toBe(5);
		expect(summary.finalView).toEqual({ count: 5, isEven: false });
		expect(summary.events.map((event) => event.payload)).toEqual([
			{ count: 2 },
			{ count: 3 },
			{ count: 4 },
			{ count: 5 },
		]);
		expect(summary.commandCount).toBe(4);
		expect(summary.traceCount).toBe(24);
		expect(summary.lifecycleCount).toBe(0);

		story.stop();

		await expect(() => story.execute("increment", 1)).rejects.toThrow(
			'[igniteCore] Story "counter reaches five" has been stopped.',
		);
		expect((await register.execute("increment", 1)).state.counter.count).toBe(
			6,
		);
	});

	it("records DOM lifecycle evidence for active stories and detaches on stop", async () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
		});

		type RenderArgs = {
			count: number;
			increment: () => void;
		};

		const story = register.record("component lifecycle");
		const elementName = `story-lifecycle-${crypto.randomUUID()}`;
		const renderFn = vi.fn<(args: RenderArgs) => TemplateResult>(
			(_args) => html``,
		);

		register(elementName, renderFn);
		const element = document.createElement(elementName);
		document.body.appendChild(element);
		await story.execute("increment");
		element.remove();

		const lifecycle = story.lifecycle();
		expect(lifecycle.map((entry) => entry.stage)).toEqual(
			expect.arrayContaining([
				"registered",
				"connected",
				"rendered",
				"disconnected",
				"cleaned-up",
			]),
		);
		expect(lifecycle.every((entry) => entry.elementName === elementName)).toBe(
			true,
		);
		expect(story.summary().lifecycleCount).toBe(lifecycle.length);

		story.stop();
		const lifecycleCount = story.lifecycle().length;
		const secondElement = document.createElement(elementName);
		document.body.appendChild(secondElement);
		secondElement.remove();

		expect(story.lifecycle()).toHaveLength(lifecycleCount);
		expect((await register.execute("increment")).state.counter.count).toBe(2);
	});

	it("projects runtime stories into an accessibility bridge without mixing trace entries", async () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
		});

		const story = register.record("dom accessibility bridge");
		const bridge = igniteTest.accessibilityBridge(
			register,
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
							"aria-label": "Counter total",
							children: String(count),
						}),
						jsx("button", {
							type: "button",
							onClick: () => increment(1),
							children: "Increment",
						}),
					],
				}),
			{ elementName: "story-dom-bridge" },
		);

		await story.execute("increment", 2);

		const [statusElement, buttonElement] = igniteTest.expectControls(bridge, [
			{
				role: "status",
				name: "Counter total",
				text: "2",
			},
			{
				role: "button",
				name: "Increment",
			},
		]);

		expect(statusElement.textContent).toBe("2");
		expect(buttonElement.textContent?.trim()).toBe("Increment");
		expect(story.trace().map((entry) => entry.kind)).toEqual([
			"command",
			"state",
			"view",
			"state",
			"view",
		]);
		expect(story.lifecycle().map((entry) => entry.stage)).toEqual(
			expect.arrayContaining(["connected", "rendered"]),
		);
		expect(
			story
				.lifecycle()
				.every((entry) => entry.elementName === "story-dom-bridge"),
		).toBe(true);

		bridge.stop();

		expect(story.lifecycle().map((entry) => entry.stage)).toEqual(
			expect.arrayContaining(["disconnected", "cleaned-up"]),
		);

		story.stop();
	});

	it("exposes a JSON-serializable agent schema", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
		});

		expect(register.getSchema()).toEqual({
			commands: {
				increment: {},
			},
			events: ["counter-incremented"],
			state: {
				counter: {
					count: 0,
				},
			},
		});
	});

	it("serializes self-returning toJSON values as circular schema values", () => {
		const selfReturning = {
			toJSON() {
				return selfReturning;
			},
		};

		expect(toSchemaValue(selfReturning)).toBe("[Circular]");
	});

	it("adds optional command contract metadata without changing execution", async () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor, command }) => ({
				addByAmount: command(
					(amount: number) =>
						actor.dispatch(counterSlice.actions.addByAmount(amount)),
					{
						description: "Add a bounded amount to the counter.",
						input: command.number({ minimum: 1, maximum: 5 }),
					},
				),
				increment: () => actor.dispatch(counterSlice.actions.increment()),
			}),
		});

		const result = await register.execute("addByAmount", 3);

		expect(result.state.counter.count).toBe(3);
		expect(register.getView()).toEqual({ count: 3 });
		expect(register.getSchema()).toEqual({
			commands: {
				addByAmount: {
					description: "Add a bounded amount to the counter.",
					input: {
						type: "number",
						minimum: 1,
						maximum: 5,
					},
				},
				increment: {},
			},
			events: [],
			state: {
				counter: {
					count: 3,
				},
			},
		});
	});

	it("serializes string, boolean, enum, object, and array command metadata", async () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor, command }) => ({
				configureCounter: command(
					(payload: {
						label: string;
						enabled: boolean;
						mode: "apply" | "skip";
						values: number[];
						limits: { minimum: number; maximum: number };
					}) => {
						if (!payload.enabled || payload.mode === "skip") {
							return actor.dispatch(counterSlice.actions.addByAmount(0));
						}

						return actor.dispatch(
							counterSlice.actions.addByAmount(
								payload.values.reduce((sum, value) => sum + value, 0),
							),
						);
					},
					{
						description: "Configure counter automation.",
						input: command.object(
							{
								label: command.string({ minLength: 1, maxLength: 32 }),
								enabled: command.boolean({ default: true }),
								mode: command.enum(["apply", "skip"], {
									default: "apply",
								}),
								values: command.array(command.number({ minimum: 0 }), {
									minItems: 1,
								}),
								limits: command.object(
									{
										minimum: command.number({ minimum: 0 }),
										maximum: command.number({ minimum: 0 }),
									},
									{
										required: ["minimum", "maximum"],
									},
								),
							},
							{
								required: ["label", "enabled", "mode", "values", "limits"],
							},
						),
					},
				),
			}),
		});

		const result = await register.execute("configureCounter", {
			label: "shift-a",
			enabled: true,
			mode: "apply",
			values: [1, 2, 3],
			limits: { minimum: 0, maximum: 12 },
		});

		expect(result.state.counter.count).toBe(6);
		expect(register.getView()).toEqual({ count: 6 });
		expect(register.getSchema()).toEqual({
			commands: {
				configureCounter: {
					description: "Configure counter automation.",
					input: {
						type: "object",
						properties: {
							label: {
								type: "string",
								minLength: 1,
								maxLength: 32,
							},
							enabled: {
								type: "boolean",
								default: true,
							},
							mode: {
								type: "string",
								enum: ["apply", "skip"],
								default: "apply",
							},
							values: {
								type: "array",
								items: {
									type: "number",
									minimum: 0,
								},
								minItems: 1,
							},
							limits: {
								type: "object",
								properties: {
									minimum: {
										type: "number",
										minimum: 0,
									},
									maximum: {
										type: "number",
										minimum: 0,
									},
								},
								required: ["minimum", "maximum"],
							},
						},
						required: ["label", "enabled", "mode", "values", "limits"],
					},
				},
			},
			events: [],
			state: {
				counter: {
					count: 6,
				},
			},
		});
	});

	it("keeps command metadata isolated when a function is reused", () => {
		const store = counterStore();
		const add = (amount: number) =>
			store.dispatch(counterSlice.actions.addByAmount(amount));

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ command }) => ({
				addLarge: command(add, {
					description: "Add a larger amount.",
					input: command.number({ minimum: 5, maximum: 10 }),
				}),
				addSmall: command(add, {
					description: "Add a smaller amount.",
					input: command.number({ minimum: 1, maximum: 4 }),
				}),
			}),
		});

		register.execute("addSmall", 2);
		register.execute("addLarge", 5);

		expect(register.getState().counter.count).toBe(7);
		expect(register.getSchema().commands).toEqual({
			addLarge: {
				description: "Add a larger amount.",
				input: {
					type: "number",
					minimum: 5,
					maximum: 10,
				},
			},
			addSmall: {
				description: "Add a smaller amount.",
				input: {
					type: "number",
					minimum: 1,
					maximum: 4,
				},
			},
		});
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
		const firstArgs = renderFn.mock.calls[renderFn.mock.calls.length - 1]?.[0];
		expect(firstArgs).toBeDefined();

		const secondElement = document.createElement(elementName);
		document.body.appendChild(secondElement);
		const secondArgs = renderFn.mock.calls[
			renderFn.mock.calls.length - 1
		]?.[0] as RenderArgs | undefined;
		expect(secondArgs).toBeDefined();

		expect(firstArgs?.count).toBe(0);
		expect(secondArgs?.count).toBe(0);

		firstArgs?.increment();
		const afterFirst = renderFn.mock.calls[
			renderFn.mock.calls.length - 1
		]?.[0] as RenderArgs | undefined;
		expect(afterFirst).toBeDefined();
		expect(afterFirst?.count).toBe(1);
		expect(store.getState().counter.count).toBe(1);

		secondArgs?.increment();
		const afterSecond = renderFn.mock.calls[
			renderFn.mock.calls.length - 1
		]?.[0] as RenderArgs | undefined;
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
		const firstArgs = renderFn.mock.calls[renderFn.mock.calls.length - 1]?.[0];
		expect(firstArgs).toBeDefined();

		const secondElement = document.createElement(elementName);
		document.body.appendChild(secondElement);
		const secondArgs = renderFn.mock.calls[
			renderFn.mock.calls.length - 1
		]?.[0] as RenderArgs | undefined;
		expect(secondArgs).toBeDefined();

		expect(firstArgs?.increment).not.toBe(secondArgs?.increment);
		expect(firstArgs?.count).toBe(0);
		expect(secondArgs?.count).toBe(0);

		firstArgs?.increment();
		const afterFirst = renderFn.mock.calls[
			renderFn.mock.calls.length - 1
		]?.[0] as RenderArgs | undefined;
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
