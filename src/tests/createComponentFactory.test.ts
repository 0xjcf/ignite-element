import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponentFactory } from "../createComponentFactory";
import { StateScope } from "../IgniteAdapter";
import type {
	FacadeCommandsCallback,
	FacadeStatesCallback,
} from "../RenderArgs";
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

		expect(() =>
			factory(elementName, () => {
				return html``;
			}),
		).toThrow(
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

		expect(() =>
			factory(elementName, () => {
				return html``;
			}),
		).toThrow(
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

		expect(() =>
			factory(elementName, () => {
				return html``;
			}),
		).toThrow(
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
		const commandsCallback = (actor: FallbackActor) => ({
			increment: () => actor.send({ type: "INC" }),
		});

		const factory = createComponentFactory<
			CounterState,
			CounterEvent,
			CounterState,
			typeof statesCallback,
			FallbackActor,
			typeof commandsCallback,
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

		const statesCallback: FacadeStatesCallback<
			CustomState,
			{ value: number }
		> = (snapshot) => ({ value: snapshot.value });
		const commandsCallback: FacadeCommandsCallback<
			CustomActor,
			{ invoke: () => void }
		> = (resolvedActor) => ({
			invoke: () => resolvedActor.send("ping"),
		});

		const factory = createComponentFactory<
			CustomState,
			CustomEvent,
			CustomState,
			typeof statesCallback,
			CustomActor,
			typeof commandsCallback
		>(createAdapter, {
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
});
