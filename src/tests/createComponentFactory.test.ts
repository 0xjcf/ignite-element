import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponentFactory } from "../createComponentFactory";
import { event } from "../events";
import { StateScope } from "../IgniteAdapter";
import MockAdapter from "./MockAdapter";

describe("createComponentFactory", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("throws when states callback does not return a plain object", () => {
		const adapter = new MockAdapter({ count: 0 }, StateScope.Shared);
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Shared,
		});

		const factory = createComponentFactory(createAdapter, {
			// @ts-expect-error - states callback returns a non-object for runtime validation.
			states: () => 123,
		});

		const elementName = `ccf-invalid-states-${crypto.randomUUID()}`;

		factory(elementName, () => html``);

		const Component = customElements.get(elementName);
		expect(Component).toBeDefined();
		if (!Component) {
			throw new Error("Expected custom element to be registered");
		}

		expect(() => {
			new Component();
		}).toThrowError(
			"[createComponentFactory] Facade states callback must return a plain object.",
		);
	});

	it("throws when commands callback does not return a plain object", () => {
		const adapter = new MockAdapter({ count: 0 }, StateScope.Shared);
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Shared,
		});

		const factory = createComponentFactory(createAdapter, {
			states: () => ({}),
			// @ts-expect-error - commands callback must return a plain object.
			commands: () => 42,
		});

		const elementName = `ccf-invalid-commands-${crypto.randomUUID()}`;

		factory(elementName, () => html``);

		const Component = customElements.get(elementName);
		expect(Component).toBeDefined();
		if (!Component) {
			throw new Error("Expected custom element to be registered");
		}

		expect(() => {
			new Component();
		}).toThrowError(
			"[createComponentFactory] Facade commands callback must return a plain object.",
		);
	});

	it("throws when a command result is not callable", () => {
		const adapter = new MockAdapter({ count: 0 }, StateScope.Shared);
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Shared,
		});

		const factory = createComponentFactory(createAdapter, {
			states: () => ({}),
			// @ts-expect-error - command results must be callable.
			commands: () => ({ bad: 1 }),
		});

		const elementName = `ccf-bad-command-${crypto.randomUUID()}`;

		factory(elementName, () => html``);

		const Component = customElements.get(elementName);
		expect(Component).toBeDefined();
		if (!Component) {
			throw new Error("Expected custom element to be registered");
		}

		expect(() => {
			new Component();
		}).toThrowError(
			'[createComponentFactory] Facade commands must return functions. Property "bad" is not callable.',
		);
	});

	it("uses fallback resolvers when none are provided", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INC" };
		const adapter = new MockAdapter<CounterState, CounterEvent>({ count: 0 });
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});

		const statesCallback = (snapshot: CounterState) => ({
			count: snapshot.count,
		});
		type FallbackActor = {
			send: (event: CounterEvent) => void;
			getState: () => CounterState;
		};
		const commandsCallback = ({ actor }: { actor: FallbackActor }) => ({
			increment: () => actor.send({ type: "INC" }),
		});

		const factory = createComponentFactory<
			CounterState,
			CounterEvent,
			CounterState,
			{ count: number },
			FallbackActor,
			{ increment: () => void },
			{ extra: string }
		>(createAdapter, {
			states: statesCallback,
			commands: commandsCallback,
			createAdditionalArgs: () => ({ extra: "value" }),
		});

		type FallbackArgs = {
			state: CounterState;
			send: (event: CounterEvent) => void;
			count: number;
			increment: () => void;
			extra: string;
		};

		const elementName = `ccf-fallback-${crypto.randomUUID()}`;
		let latestArgs: FallbackArgs | undefined;

		factory(elementName, (args) => {
			latestArgs = args;
			return html``;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(latestArgs).toBeDefined();
		expect(latestArgs?.extra).toBe("value");
		expect(adapter.getState).toHaveBeenCalled();
		expect(latestArgs?.count).toBe(0);

		latestArgs?.increment();
		expect(adapter.send).toHaveBeenCalledWith({ type: "INC" });
	});

	it("prefers provided snapshot and actor resolvers", () => {
		type CustomState = { value: number };
		type CustomEvent = { type: "noop" };
		const adapter = new MockAdapter<CustomState, CustomEvent>({ value: 10 });
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});

		const customSnapshot = vi.fn((): CustomState => ({ value: 99 }));
		type CustomActor = {
			send: (event: string) => void;
			getState: () => CustomState;
		};
		const actor: CustomActor = {
			send: vi.fn(),
			getState: () => ({ value: 10 }),
		};
		const customActorResolver = vi.fn((): CustomActor => actor);

		const statesCallback = (snapshot: CustomState) => ({
			value: snapshot.value,
		});
		const commandsCallback = ({
			actor: resolvedActor,
		}: {
			actor: CustomActor;
		}) => ({
			invoke: () => resolvedActor.send("ping"),
		});

		const factory = createComponentFactory(createAdapter, {
			resolveStateSnapshot: customSnapshot,
			resolveCommandActor: customActorResolver,
			states: statesCallback,
			commands: commandsCallback,
		});

		type CustomArgs = {
			state: CustomState;
			send: (event: CustomEvent) => void;
			value: number;
			invoke: () => void;
		};

		const elementName = `ccf-custom-resolvers-${crypto.randomUUID()}`;
		let latestArgs: CustomArgs | undefined;

		factory(elementName, (args) => {
			latestArgs = args;
			return html``;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(customSnapshot).toHaveBeenCalled();
		expect(customActorResolver).toHaveBeenCalled();
		expect(latestArgs?.value).toBe(99);

		latestArgs?.invoke();
		expect(actor.send).toHaveBeenCalledWith("ping");
	});

	it("emits declared events with payload and host context", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INC" };
		const adapter = new MockAdapter<CounterState, CounterEvent>({ count: 0 });
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
		});

		const states = (snapshot: CounterState) => ({ count: snapshot.count });
		const eventsMap = {
			"counter-incremented": event<{ amount: number }>(),
		};
		const commands = ({
			actor,
			emit,
			host,
		}: {
			actor: { send: (event: CounterEvent) => void };
			emit: (type: "counter-incremented", payload: { amount: number }) => void;
			host: HTMLElement;
		}) => ({
			increment: () => {
				const amountAttr = host.getAttribute("data-amount");
				const amount = amountAttr ? Number(amountAttr) : 1;
				emit("counter-incremented", { amount });
				actor.send({ type: "INC" });
			},
		});

		const factory = createComponentFactory<
			CounterState,
			CounterEvent,
			CounterState,
			{ count: number },
			{ send: (event: CounterEvent) => void },
			{ increment: () => void },
			Record<never, never>,
			typeof eventsMap
		>(createAdapter, {
			states,
			commands,
			events: eventsMap,
		});

		type EventArgs = {
			state: CounterState;
			send: (event: CounterEvent) => void;
			count: number;
			increment: () => void;
		};

		const elementName = `ccf-events-${crypto.randomUUID()}`;
		let latestArgs: EventArgs | undefined;

		factory(elementName, (args) => {
			latestArgs = args;
			return html``;
		});

		const element = document.createElement(elementName);
		element.setAttribute("data-amount", "5");
		const order: string[] = [];

		const isCounterIncrementEvent = (
			event: Event,
		): event is CustomEvent<{ amount: number }> => event instanceof CustomEvent;

		const listener = vi.fn((event: Event) => {
			if (!isCounterIncrementEvent(event)) {
				throw new Error("Unexpected event type");
			}
			order.push("emit");
			expect(event.detail.amount).toBe(5);
		});

		element.addEventListener("counter-incremented", listener);
		vi.spyOn(adapter, "send").mockImplementation(() => {
			order.push("send");
		});

		document.body.appendChild(element);
		expect(latestArgs).toBeDefined();

		latestArgs?.increment();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(order).toEqual(["emit", "send"]);
	});
});
