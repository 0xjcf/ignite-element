import { html } from "lit-html";
import { afterEach, describe, expect, it } from "vitest";
import { setGlobalStyles } from "../../globalStyles";
import { LitRenderStrategy } from "../../renderers/LitRenderStrategy";

afterEach(() => {
	setGlobalStyles(undefined);
});

describe("LitRenderStrategy", () => {
	it("attaches and renders without throwing", () => {
		setGlobalStyles({ href: "./theme.css" });
		const host = document.createElement("div").attachShadow({ mode: "open" });
		const strategy = new LitRenderStrategy();

		expect(() => strategy.attach(host)).not.toThrow();
		const linkElement = host.querySelector("link");
		expect(linkElement).toBeTruthy();

		expect(() => strategy.render(html`<p>Rendered</p>`)).not.toThrow();
	});

	it("throws when rendering before attach", () => {
		const strategy = new LitRenderStrategy();

		expect(() => strategy.render(html`<p>Rendered</p>`)).toThrow(
			"[LitRenderStrategy] Cannot render before attach has been invoked.",
		);
	});
});
