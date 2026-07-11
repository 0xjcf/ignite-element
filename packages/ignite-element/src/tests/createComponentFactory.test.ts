import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponentFactory } from "../createComponentFactory";
import { StateScope } from "../IgniteAdapter";
import type { ViewContext } from "../RenderArgs";
import MockAdapter from "./MockAdapter";

function createMockAdapterFactory<State, Event>(
	adapter: MockAdapter<State, Event>,
	scope: StateScope,
) {
	return Object.assign(() => adapter, {
		scope,
		resolveStateSnapshot: () => adapter.getSnapshot(),
		resolveCommandActor: () => ({
			send: (event: Event) => adapter.send(event),
			getState: () => adapter.getSnapshot(),
		}),
	});
}

describe("createComponentFactory", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("throws when view callback does not return a plain object", () => {
		const adapter = new MockAdapter({ count: 0 }, StateScope.Shared);
		const createAdapter = createMockAdapterFactory(adapter, StateScope.Shared);

		const factory = createComponentFactory(createAdapter, {
			// @ts-expect-error - view callback returns a non-object for runtime validation.
			view: () => 123,
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
			"[createComponentFactory] Facade view callback must return a plain object.",
		);
	});

	it("throws when commands callback does not return a plain object", () => {
		const adapter = new MockAdapter({ count: 0 }, StateScope.Shared);
		const createAdapter = createMockAdapterFactory(adapter, StateScope.Shared);

		const factory = createComponentFactory(createAdapter, {
			view: () => ({}),
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
		const createAdapter = createMockAdapterFactory(adapter, StateScope.Shared);

		const factory = createComponentFactory(createAdapter, {
			view: () => ({}),
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

	it("uses adapter-factory resolvers when options omit overrides", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INC" };
		const adapter = new MockAdapter<CounterState, CounterEvent>({ count: 0 });
		const createAdapter = createMockAdapterFactory(
			adapter,
			StateScope.Isolated,
		);

		const viewCallback = ({ snapshot }: ViewContext<CounterState>) => ({
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
			view: viewCallback,
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
		expect(adapter.getSnapshot).toHaveBeenCalled();
		expect(latestArgs?.count).toBe(0);

		latestArgs?.increment();
		expect(adapter.send).toHaveBeenCalledWith({ type: "INC" });
	});

	it("prefers provided snapshot and actor resolvers", () => {
		type CustomState = { value: number };
		type CustomEvent = { type: "noop" };
		const adapter = new MockAdapter<CustomState, CustomEvent>({ value: 10 });

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
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot: () => adapter.getSnapshot(),
			resolveCommandActor: (): CustomActor => actor,
		});

		const viewCallback = ({ snapshot }: ViewContext<CustomState>) => ({
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
			view: viewCallback,
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

	it("provides host context to commands", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INC" };
		const adapter = new MockAdapter<CounterState, CounterEvent>({ count: 0 });
		const createAdapter = createMockAdapterFactory(
			adapter,
			StateScope.Isolated,
		);

		const view = ({ snapshot }: ViewContext<CounterState>) => ({
			count: snapshot.count,
		});
		const commands = ({
			actor,
			host,
		}: {
			actor: { send: (event: CounterEvent) => void };
			host: HTMLElement;
		}) => ({
			increment: () => {
				const amountAttr = host.getAttribute("data-amount");
				const amount = amountAttr ? Number(amountAttr) : 1;
				host.setAttribute("data-last-amount", String(amount));
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
			Record<never, never>
		>(createAdapter, {
			view,
			commands,
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
		vi.spyOn(adapter, "send").mockImplementation(() => {
			order.push("send");
		});

		document.body.appendChild(element);
		expect(latestArgs).toBeDefined();

		latestArgs?.increment();

		expect(element.getAttribute("data-last-amount")).toBe("5");
		expect(order).toEqual(["send"]);
	});

	it("rejects custom generics when adapter metadata has standard types", () => {
		type CounterState = { count: number };
		type CounterEvent = { type: "INC" };
		type CustomSnapshot = { label: string };
		type CustomActor = { publish: () => void };
		const adapter = new MockAdapter<CounterState, CounterEvent>({ count: 0 });
		const createAdapter = createMockAdapterFactory(
			adapter,
			StateScope.Isolated,
		);

		const assertIncompatibleMetadata = () =>
			createComponentFactory<
				CounterState,
				CounterEvent,
				CustomSnapshot,
				Record<never, never>,
				CustomActor
			>(
				// @ts-expect-error - custom generics require matching factory metadata.
				createAdapter,
				{
					resolveStateSnapshot: () => ({ label: "custom" }),
					resolveCommandActor: () => ({ publish: () => undefined }),
				},
			);

		void assertIncompatibleMetadata;
	});
});
