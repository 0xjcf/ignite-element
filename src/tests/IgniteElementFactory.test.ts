import type { TemplateResult } from "lit-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import igniteElementFactory from "../IgniteElementFactory";
import MinimalMockAdapter from "./MockAdapter";

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

		component(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter.subscribe).toHaveBeenCalled();
	});

	it("creates a new adapter instance per component when factory returns fresh adapters", () => {
		const createAdapter = vi
			.fn()
			.mockImplementation(
				() => new MinimalMockAdapter<typeof initialState, { type: string }>(initialState),
			);

		const component = igniteElementFactory(createAdapter);
		const elementName = `ignite-component-${crypto.randomUUID()}`;

		component(elementName, () => {
			return {} as TemplateResult;
		});

		const first = document.createElement(elementName);
		const second = document.createElement(elementName);
		document.body.append(first, second);

		expect(createAdapter).toHaveBeenCalledTimes(2);
	});

	it("injects provided styles into the shadow DOM", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const styles = { custom: "div { color: red; }" };

		const component = igniteElementFactory(() => adapter, { styles });
		const elementName = `ignite-styled-${crypto.randomUUID()}`;

		component(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		const styleElement = element.shadowRoot?.querySelector("style");
		expect(styleElement?.textContent).toContain(styles.custom);
	});

	it("throws when attempting to define an element more than once", () => {
		const adapter = new MinimalMockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		const elementName = `ignite-duplicate-${crypto.randomUUID()}`;

		component(elementName, () => {
			return {} as TemplateResult;
		});

		expect(() =>
			component(elementName, () => {
				return {} as TemplateResult;
			}),
		).toThrowError(
			`[igniteElementFactory] Element "${elementName}" has already been defined.`,
		);
	});
});
