import { html } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StateScope } from "../IgniteAdapter";
import igniteElementFactory from "../IgniteElementFactory";
import MinimalMockAdapter from "./MockAdapter";

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("igniteElementFactory", () => {
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
		expect(() => queuedMicrotasks[0]?.()).toThrow(disconnectError);
		expect(onTrueDisconnect).toHaveBeenCalledTimes(1);
		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});
});
