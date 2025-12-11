import { describe, expect, it, vi } from "vitest";
import injectStyles from "../../injectStyles";
import { LitRenderStrategy } from "../../renderers/LitRenderStrategy";

vi.mock("../../injectStyles", () => ({
	__esModule: true,
	default: vi.fn(),
}));

describe("LitRenderStrategy", () => {
	it("attaches and renders without throwing", () => {
		const host = document.createElement("div").attachShadow({ mode: "open" });
		const strategy = new LitRenderStrategy();

		expect(() => strategy.attach(host)).not.toThrow();
		expect(injectStyles).toHaveBeenCalledWith(host);

		expect(() => strategy.render({} as never)).not.toThrow();
	});
});
