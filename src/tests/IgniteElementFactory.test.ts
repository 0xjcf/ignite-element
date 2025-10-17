import type { TemplateResult } from "lit-html";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type IgniteElement from "../IgniteElement";
import igniteElementFactory, { type IgniteCore } from "../IgniteElementFactory";
import type { RenderArgs } from "../RenderArgs";
import MinimalMockAdapter from "./MockAdapter";

describe("IgniteElementFactory", () => {
	const initialState = { count: 0 };
	type State = typeof initialState;
	type Event = { type: string };
	let adapter: MinimalMockAdapter<State, Event>;
	let core: IgniteCore<State, Event>;
	let uniqueId: string;

	beforeEach(() => {
		uniqueId = crypto.randomUUID();
		adapter = new MinimalMockAdapter(initialState);
		core = igniteElementFactory(() => adapter);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.resetAllMocks();
	});

	it("should create shared components and subscribe to adapter", () => {
		const elementName = `shared-counter-${uniqueId}`;
		core.shared(elementName, ({ state }) => {
			expect(state).toEqual(initialState);
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(element).toBeDefined();
		expect(adapter.subscribe).toHaveBeenCalled();
	});

	it("should create isolated components and subscribe to adapter", () => {
		const elementName = `isolated-counter-${uniqueId}`;
		core.isolated(elementName, ({ state }) => {
			expect(state).toEqual(initialState);
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(element).toBeDefined();
		expect(adapter.subscribe).toHaveBeenCalled();
	});

	it("should initialize adapter during connectedCallback", () => {
		const elementName = `isolated-counter-${uniqueId}`;
		core.isolated(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		expect(adapter.subscribe).toHaveBeenCalledTimes(1);
	});

	it("should pause updates when isolated component is disconnected", () => {
		const elementName = `isolated-counter-${uniqueId}`;
		core.isolated(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName) as IgniteElement<
			State,
			Event
		>;
		document.body.appendChild(element);
		document.body.removeChild(element);

		expect(element.isActive).toBe(false);
		expect(adapter.stop).not.toHaveBeenCalled();
	});

	it("should resume updates when isolated component is reconnected", () => {
		const elementName = `isolated-counter-${uniqueId}`;
		core.isolated(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName) as IgniteElement<
			State,
			Event
		>;
		document.body.appendChild(element);
		document.body.removeChild(element);
		document.body.appendChild(element);

		expect(element.isActive).toBe(true);
		expect(element.shadowRoot?.textContent).toBeDefined();
	});

	it("should preserve adapter subscription on reconnection", () => {
		const elementName = `isolated-counter-${uniqueId}`;
		core.isolated(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);
		const stateBefore = adapter.getState();
		document.body.removeChild(element);
		document.body.appendChild(element);

		const stateAfter = adapter.getState();
		expect(stateBefore).toEqual(stateAfter);
	});

	it("should inject custom styles into the shadow DOM", () => {
		const styles = { custom: "div { color: red; }" };
		const core = igniteElementFactory(() => adapter, { styles });

		const elementName = `shared-styled-counter-${uniqueId}`;
		core.shared(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		const shadowRoot = element.shadowRoot;
		const styleElement = shadowRoot?.querySelector("style");

		expect(styleElement).toBeDefined();
		expect(styleElement?.textContent).toContain(styles.custom);
	});

	it("should inject external stylesheet paths into the shadow DOM", () => {
		const styles = {
			paths: [
				"https://example.com/styles.css",
				{ href: "https://example.com/other-styles.css", integrity: "abc123" },
			],
		};
		const core = igniteElementFactory(() => adapter, { styles });

		const elementName = `shared-styled-paths-${uniqueId}`;
		core.shared(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		const shadowRoot = element.shadowRoot;
		const linkElements = shadowRoot?.querySelectorAll("link");

		expect(linkElements?.length).toBe(2);
		expect(linkElements?.[0].href).toBe("https://example.com/styles.css");
		expect(linkElements?.[1].href).toBe("https://example.com/other-styles.css");
		expect(linkElements?.[1].integrity).toBe("abc123");
	});

	it("should inject external stylesheet with crossorigin into the shadow DOM", () => {
		const styles = {
			paths: [
				{
					href: "https://example.com/secure-styles.css",
					integrity: "sha256-123",
					crossOrigin: "anonymous",
				},
			],
		};
		const core = igniteElementFactory(() => adapter, { styles });

		const elementName = `shared-styled-crossorigin-${uniqueId}`;
		core.shared(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		const shadowRoot = element.shadowRoot;
		const linkElement = shadowRoot?.querySelector("link");

		expect(linkElement).toBeDefined();
		expect(linkElement?.href).toBe("https://example.com/secure-styles.css");
		expect(linkElement?.integrity).toBe("sha256-123");
		expect(linkElement?.crossOrigin).toBe("anonymous");
	});

	it("should log a warning for invalid style paths", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const styles = {
			paths: [42, { invalidProp: "invalidValue" }, "./valid.css"],
		};

		// @ts-expect-error numbers are not valid styles
		const core = igniteElementFactory(() => adapter, { styles });

		const elementName = `shared-styled-invalid-${uniqueId}`;
		core.shared(elementName, () => {
			return {} as TemplateResult;
		});

		const element = document.createElement(elementName);
		document.body.appendChild(element);

		// Expect warnings for invalid styles
		expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", 42);
		expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", {
			invalidProp: "invalidValue",
		});

		// Ensure valid styles are not logged as warnings
		expect(warnSpy).not.toHaveBeenCalledWith(
			"Invalid style path/object:",
			"./valid.css",
		);

		warnSpy.mockRestore();
	});

	it("should create a shared component using the Shared decorator", () => {
		const decoratorId = crypto.randomUUID();
		const functionId = crypto.randomUUID();

		@core.Shared(`shared-decorator-${decoratorId}`)
		// biome-ignore lint/correctness/noUnusedVariables: Decorator registration relies on class declaration side-effects
		class SharedCounter {
			render({ state }: RenderArgs<State, Event>): TemplateResult {
				expect(state).toEqual(initialState); // Ensure initial state
				return {} as TemplateResult;
			}
		}

		// Create and test the decorated component
		const decoratedElement = document.createElement(
			`shared-decorator-${decoratorId}`,
		);
		document.body.appendChild(decoratedElement);

		// Create a different component for comparison
		core.shared(`shared-function-${functionId}`, ({ state }) => {
			expect(state).toEqual(initialState);
			return {} as TemplateResult;
		});

		const functionElement = document.createElement(
			`shared-function-${functionId}`,
		);
		document.body.appendChild(functionElement);

		// Verify both components exist and are subscribed
		expect(decoratedElement).toBeDefined();
		expect(functionElement).toBeDefined();
		expect(adapter.subscribe).toHaveBeenCalledTimes(2);

		// Verify shadowRoot is set up for both
		expect(decoratedElement.shadowRoot).toBeDefined();
		expect(functionElement.shadowRoot).toBeDefined();
	});

	it("should create an isolated component using the Isolated decorator", () => {
		const decoratorId = crypto.randomUUID();
		const functionId = crypto.randomUUID();

		@core.Isolated(`isolated-decorator-${decoratorId}`)
		// biome-ignore lint/correctness/noUnusedVariables: Decorator registration relies on class declaration side-effects
		class IsolatedCounter {
			render({ state }: RenderArgs<State, Event>): TemplateResult {
				expect(state).toEqual(initialState); // Ensure initial state
				return {} as TemplateResult;
			}
		}

		// Create and test the decorated component
		const decoratedElement = document.createElement(
			`isolated-decorator-${decoratorId}`,
		);
		document.body.appendChild(decoratedElement);

		// Create a different component for comparison
		core.isolated(`isolated-function-${functionId}`, ({ state }) => {
			expect(state).toEqual(initialState);
			return {} as TemplateResult;
		});

		const functionElement = document.createElement(
			`isolated-function-${functionId}`,
		);
		document.body.appendChild(functionElement);

		// Verify both components exist and are subscribed
		expect(decoratedElement).toBeDefined();
		expect(functionElement).toBeDefined();
		expect(adapter.subscribe).toHaveBeenCalledTimes(2);

		// Verify shadowRoot is set up for both
		expect(decoratedElement.shadowRoot).toBeDefined();
		expect(functionElement.shadowRoot).toBeDefined();
	});
});
