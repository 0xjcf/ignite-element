import type { IgniteAdapter } from "@ignite-element/core";
import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponentFactory } from "../createComponentFactory";
import { StateScope } from "../IgniteAdapter";
import igniteElementFactory from "../IgniteElementFactory";
import { createProjectionDocumentTarget } from "../index";
import * as strategyResolution from "../renderers/resolveConfiguredRenderStrategy";
import { facadeCleanupSymbol } from "../runtime/effects";
import type { IgniteAgentRuntime, ProjectionDocument } from "../types/agent";
import MinimalMockAdapter from "./MockAdapter";

it("selects configured rendering at registration, and never with an override", () => {
	const spy = vi.spyOn(strategyResolution, "resolveConfiguredRenderStrategy");
	const createAdapter = vi.fn(() => new MinimalMockAdapter({ count: 0 }));
	const core = igniteElementFactory(createAdapter);
	expect(spy).not.toHaveBeenCalled();
	expect(createAdapter).not.toHaveBeenCalled();
	core(`selection-${crypto.randomUUID()}`, () => null);
	expect(spy).toHaveBeenCalledTimes(1);
	spy.mockClear();
	const override = igniteElementFactory(createAdapter, {
		createRenderStrategy: () => ({ attach() {}, render() {} }),
	});
	override(`override-${crypto.randomUUID()}`, () => null);
	expect(spy).not.toHaveBeenCalled();
	spy.mockRestore();
});

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("igniteElementFactory", () => {
	it("balances shared runtime access when watcher setup fails", async () => {
		const document: ProjectionDocument = {
			id: "shared-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};
		const snapshot = { documents: [document], speech: null };
		let failWatcherSetup = true;
		const unsubscribe = vi.fn();
		const stop = vi.fn();
		const adapter: IgniteAdapter<typeof snapshot, { type: "NOOP" }> = {
			scope: StateScope.Shared,
			subscribeSnapshots: (listener) => {
				if (failWatcherSetup) {
					throw new Error("watcher setup failed");
				}
				listener(snapshot);
				return { unsubscribe };
			},
			send: () => undefined,
			getSnapshot: () => snapshot,
			stop,
		};
		const acquireAdapter = vi.fn(() => ({
			...adapter,
			stop: vi.fn(() => stop()),
		}));
		const createAdapter = Object.assign(acquireAdapter, {
			scope: StateScope.Shared,
			resolveStateSnapshot: (
				current: IgniteAdapter<typeof snapshot, { type: "NOOP" }>,
			) => current.getSnapshot(),
			resolveCommandActor: (
				current: IgniteAdapter<typeof snapshot, { type: "NOOP" }>,
			) => ({
				send: (event: { type: "NOOP" }) => current.send(event),
				getState: () => current.getSnapshot(),
			}),
		});
		const core = createComponentFactory(createAdapter, {
			states: () => ({}),
			commands: () => ({}),
			cleanup: true,
			createRenderStrategy: () => ({
				attach: () => undefined,
				render: () => undefined,
			}),
		});
		const ghostCommit = vi.fn();
		expect(() =>
			Reflect.apply(core, undefined, [
				createProjectionDocumentTarget({ commitDocument: ghostCommit }),
			]),
		).toThrow("watcher setup failed");
		expect(acquireAdapter).toHaveBeenCalledOnce();
		expect(acquireAdapter.mock.results[0]?.value.stop).not.toHaveBeenCalled();
		failWatcherSetup = false;
		const elementName = `shared-cleanup-${crypto.randomUUID()}`;
		core(elementName, () => "ready");
		const element = globalThis.document.createElement(elementName);
		globalThis.document.body.append(element);
		element.remove();
		await flushMicrotasks();
		await flushMicrotasks();
		expect(ghostCommit).not.toHaveBeenCalled();
		expect(acquireAdapter).toHaveBeenCalledOnce();
		expect(acquireAdapter.mock.results[0]?.value.stop).toHaveBeenCalledOnce();
		expect(stop).toHaveBeenCalledOnce();
	});
	const initialState = { count: 0 };

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("creates a component that subscribes to the adapter", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter);
		const elementName = `ignite-component-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter.subscribeSnapshots).toHaveBeenCalled();
	});

	it("creates a new adapter instance per component when factory returns fresh adapters", () => {
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const instance = new MinimalMockAdapter<
				typeof initialState,
				{ type: string }
			>(initialState);
			adapters.push(instance);
			return instance;
		});

		const component = igniteElementFactory(createAdapter);
		const elementName = `ignite-component-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(createAdapter).toHaveBeenCalledTimes(2);
		adapters.forEach((instance) => {
			expect(instance.scope).toBe(StateScope.Isolated);
		});
	});

	it("reuses adapter and marks scope as shared", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
		});
		const elementName = `ignite-shared-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter.scope).toBe(StateScope.Shared);
	});

	it("returns when attempting to define an element more than once", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-duplicate-${crypto.randomUUID()}`;

		component(elementName, () => html`<div></div>`);

		expect(() => component(elementName, () => html`<div></div>`)).not.toThrow();
	});

	it("supports class-based renderers", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-class-${crypto.randomUUID()}`;

		class ClassRenderer {
			render() {
				return html`<span>class renderer</span>`;
			}
		}

		const renderSpy = vi.spyOn(ClassRenderer.prototype, "render");

		component(elementName, ClassRenderer);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(renderSpy).toHaveBeenCalled();
	});

	it("creates a class renderer instance for each isolated element", () => {
		const component = igniteElementFactory(
			() => new MinimalMockAdapter(initialState),
		);
		const elementName = `ignite-class-isolated-${crypto.randomUUID()}`;
		let created = 0;

		class ClassRenderer {
			readonly instanceId = ++created;

			render() {
				return html`<span>renderer ${this.instanceId}</span>`;
			}
		}

		component(elementName, ClassRenderer);
		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(created).toBe(2);
	});

	it("supports object renderers", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-object-${crypto.randomUUID()}`;

		const renderObject = {
			template: html`<span>object renderer</span>`,
			render() {
				return this.template;
			},
		};
		const renderSpy = vi.spyOn(renderObject, "render");

		component(elementName, renderObject);

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(renderSpy).toHaveBeenCalled();
	});

	it("throws when renderer does not provide a render implementation", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
		});
		const elementName = `ignite-invalid-${crypto.randomUUID()}`;

		expect(() => component(elementName, 123 as unknown as never)).toThrow(
			"[igniteElementFactory] Invalid renderer provided. Supply a render function, an object with a render method, or a class with a render method.",
		);
	});

	it("keeps the shared (consumer-owned) adapter alive when the last element disconnects (default cleanup)", () => {
		// Repro for the SPA-router outlet-swap footgun: one core registered under
		// multiple element names shares ONE adapter. Swapping pages drives the
		// refcount transiently to zero, which previously stopped the shared adapter
		// and froze every page's reads. A consumer-owned shared source lives for the
		// core's lifetime, not any one element's — disconnecting must not stop it.
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const createAdapter = vi.fn(() => adapter);

		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
		});
		const pageA = `ignite-shared-page-a-${crypto.randomUUID()}`;
		const pageB = `ignite-shared-page-b-${crypto.randomUUID()}`;
		component(pageA, () => html`<div></div>`);
		component(pageB, () => html`<div></div>`);

		const a = document.createElement(pageA);
		const b = document.createElement(pageB);
		document.body.append(a, b);
		a.remove();
		b.remove();

		expect(adapter.stop).not.toHaveBeenCalled();
	});

	it("still releases the shared adapter on last disconnect when cleanup:true is explicit", async () => {
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);

		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
		});
		const name = `ignite-shared-cleanup-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});

	it("releases shared cleanup after direct runtime access and last disconnect", async () => {
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const reportedAdapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			adapters.push(adapter);
			return adapter;
		});
		const cleanupAdditionalArgs = vi.fn();
		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (adapter) =>
				({
					reportAdapter: () => {
						reportedAdapters.push(
							adapter as MinimalMockAdapter<
								typeof initialState,
								{ type: string }
							>,
						);
					},
					[facadeCleanupSymbol]: cleanupAdditionalArgs,
				}) as never,
		});
		const name = `ignite-direct-runtime-cleanup-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const runtime = component as typeof component & {
			execute: (call: {
				command: string;
				input?: unknown;
			}) => Promise<{ snapshot: typeof initialState }>;
		};

		const initial = await runtime.execute({ command: "reportAdapter" });
		expect(initial.snapshot).toEqual(initialState);

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(cleanupAdditionalArgs).toHaveBeenCalledTimes(2);

		await runtime.execute({ command: "reportAdapter" });

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(reportedAdapters).toHaveLength(2);
		expect(reportedAdapters[0]).toBe(adapters[0]);
		expect(reportedAdapters[1]).toBe(adapters[1]);
	});

	it("resets shared runtime bookkeeping when runtime facade cleanup throws", async () => {
		const cleanupError = new Error("runtime facade cleanup failed");
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const reportedAdapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
			adapters.push(adapter);
			return adapter;
		});
		const component = igniteElementFactory(createAdapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: (adapter) =>
				({
					reportAdapter: () => {
						reportedAdapters.push(
							adapter as MinimalMockAdapter<
								typeof initialState,
								{ type: string }
							>,
						);
					},
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-direct-runtime-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const runtime = component as typeof component & {
			execute: (call: { command: string; input?: unknown }) => Promise<unknown>;
		};
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await runtime.execute({ command: "reportAdapter" });
		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);

		await runtime.execute({ command: "reportAdapter" });

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(reportedAdapters).toHaveLength(2);
		expect(reportedAdapters[0]).toBe(adapters[0]);
		expect(reportedAdapters[1]).toBe(adapters[1]);
	});

	it("logs deferred shared cleanup failures when unsubscribe releases runtime access", async () => {
		const cleanupError = new Error("runtime cleanup failed");
		const adapter = new MinimalMockAdapter(initialState, StateScope.Shared);
		const component = igniteElementFactory(() => adapter, {
			scope: StateScope.Shared,
			cleanup: true,
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-runtime-deferred-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		// The low-level factory's public return type is registration-only; its
		// assembled runtime is exercised here without widening that internal type.
		const watch: unknown = Reflect.get(component, "watch");
		if (typeof watch !== "function")
			throw new Error("Expected runtime watcher");
		const subscription: ReturnType<IgniteAgentRuntime<unknown>["watch"]> =
			watch(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();

		expect(() => subscription.unsubscribe()).not.toThrow();
		expect(adapter.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);
	});

	it("clears isolated adapter bookkeeping before additional args cleanup can fail", async () => {
		const cleanupError = new Error("isolated args cleanup failed");
		const adapters: MinimalMockAdapter<
			typeof initialState,
			{ type: string }
		>[] = [];
		const createAdapter = vi.fn(() => {
			const adapter = new MinimalMockAdapter(initialState);
			adapters.push(adapter);
			return adapter;
		});
		const component = igniteElementFactory(createAdapter, {
			createAdditionalArgs: () =>
				({
					[facadeCleanupSymbol]: () => {
						throw cleanupError;
					},
				}) as never,
		});
		const name = `ignite-isolated-cleanup-error-${crypto.randomUUID()}`;
		component(name, () => html`<div></div>`);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const element = document.createElement(name);
		document.body.appendChild(element);
		element.remove();
		await flushMicrotasks();
		document.body.appendChild(element);

		expect(createAdapter).toHaveBeenCalledTimes(2);
		expect(adapters[0]?.stop).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			cleanupError,
		);

		element.remove();
		await flushMicrotasks();
	});

	it("stops an isolated adapter when true disconnect cleanup throws", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-disconnect-error-${crypto.randomUUID()}`;
		component(elementName, () => html`<div></div>`);
		const elementConstructor = customElements.get(elementName) as
			| (CustomElementConstructor & {
					prototype: { onTrueDisconnect: () => void };
			  })
			| undefined;
		if (!elementConstructor) {
			throw new Error(`Expected ${elementName} to be registered.`);
		}
		const disconnectError = new Error("cleanup failed");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const onTrueDisconnect = vi
			.spyOn(elementConstructor.prototype, "onTrueDisconnect")
			.mockImplementation(() => {
				throw disconnectError;
			});

		const element = document.createElement(elementName);
		document.body.appendChild(element);
		const queuedMicrotasks: VoidFunction[] = [];
		vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
			queuedMicrotasks.push(callback);
		});

		element.remove();

		expect(queuedMicrotasks).toHaveLength(1);
		expect(() => queuedMicrotasks[0]?.()).not.toThrow();
		expect(errorSpy).toHaveBeenCalledWith(
			"[IgniteElement] Deferred disconnect cleanup failed.",
			disconnectError,
		);
		expect(onTrueDisconnect).toHaveBeenCalledTimes(1);
		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});
});
