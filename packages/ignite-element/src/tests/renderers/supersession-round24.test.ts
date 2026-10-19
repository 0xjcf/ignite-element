import { describe, expect, it, vi } from "vitest";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";

// Round 24 (PR #168): a detach() that throws part-way (an overridden
// ShadowRoot.removeChild) never leaves the root marked as detaching. The
// error reaches the caller, and the next render corrects the DOM.
describe("R24 a failed detach", () => {
	it("propagates the removal error and a later render() commits again", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const shadow = host.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		const first = vi.fn();
		strategy.render(jsx("p", { ref: first, children: "one" }));
		const boom = new Error("removeChild failed");
		shadow.removeChild = () => {
			throw boom;
		};
		expect(() => strategy.detach()).toThrow(boom);
		const second = vi.fn();
		strategy.render(jsx("p", { ref: second, children: "two" }));
		const root = shadow.querySelector("[data-ignite-jsx-root]");
		expect(root?.textContent).toBe("two");
		expect(second).toHaveBeenCalledWith(root?.querySelector("p"));
	});
});
