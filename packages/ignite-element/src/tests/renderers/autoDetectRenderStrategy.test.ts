import { html } from "lit-html";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { createLitRenderStrategy } from "../../renderers/LitRenderStrategy";
import {
	clearRegisteredRenderStrategiesForTests,
	createAutoDetectRenderStrategy,
	registerRenderStrategy,
} from "../../renderers/resolveConfiguredRenderStrategy";

const shadowRoot = (): ShadowRoot =>
	document.createElement("div").attachShadow({ mode: "open" });

describe("AutoDetectRenderStrategy (config-free renderer selection)", () => {
	beforeEach(() => {
		clearRegisteredRenderStrategiesForTests();
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		registerRenderStrategy("lit", createLitRenderStrategy);
	});

	afterEach(() => {
		clearRegisteredRenderStrategiesForTests();
	});

	it("routes a lit-html TemplateResult to the lit strategy", () => {
		const root = shadowRoot();
		const strategy = createAutoDetectRenderStrategy();
		strategy.attach(root);

		strategy.render(html`<p>hello lit</p>`);

		expect(root.textContent).toContain("hello lit");
		// the bug being fixed: a lit TemplateResult must not fall through to the
		// jsx strategy's "unknown" placeholder.
		expect(root.innerHTML).not.toContain("ignite-unknown");
		// switching to lit tears down the eagerly-attached ignite-jsx root.
		expect(root.querySelector("[data-ignite-jsx-root]")).toBeNull();
	});

	it("routes a non-lit view to the ignite-jsx strategy", () => {
		const root = shadowRoot();
		const strategy = createAutoDetectRenderStrategy();
		strategy.attach(root);

		strategy.render(jsx("p", { children: "hello jsx" }));

		expect(root.querySelector("[data-ignite-jsx-root]")).not.toBeNull();
		expect(root.textContent).toContain("hello jsx");
	});

	it("falls back to ignite-jsx (no throw) when a lit view is rendered but lit is not registered", () => {
		// Backward-compatible: components that author throwaway lit views without
		// selecting lit keep the pre-existing ignite-jsx behavior instead of
		// crashing. (Import "@ignite-element/renderer/lit" to actually render lit.)
		clearRegisteredRenderStrategiesForTests();
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		const root = shadowRoot();
		const strategy = createAutoDetectRenderStrategy();
		strategy.attach(root);

		expect(() => strategy.render(html`<p>x</p>`)).not.toThrow();
		expect(root.querySelector("[data-ignite-jsx-root]")).not.toBeNull();
	});
});
