import { html } from "lit-html";
import { describe, expect, it, vi } from "vitest";
import * as injectStylesModule from "../../injectStyles";
import { createLitRenderStrategy } from "../../renderers/LitRenderStrategy";

describe("Lit render strategy", () => {
	it("throws when render is called before attach", () => {
		const strategy = createLitRenderStrategy();
		expect(() => strategy.render(html`<div />`)).toThrow(
			"[LitRenderStrategy] Cannot render before attach has been invoked.",
		);
	});

	it("attaches, renders, and reuses host after detach", () => {
		const hostElement = document.createElement("div");
		const shadow = hostElement.attachShadow({ mode: "open" });
		const injectSpy = vi.spyOn(injectStylesModule, "default");

		const strategy = createLitRenderStrategy();
		strategy.attach(shadow);
		expect(injectSpy).toHaveBeenCalledWith(shadow);

		strategy.render(html`<span>lit</span>`);
		expect(shadow.textContent).toBe("lit");

		strategy.detach();
		strategy.attach(shadow);
		strategy.render(html`<span>again</span>`);
		expect(shadow.textContent).toBe("again");

		injectSpy.mockRestore();
	});
});
