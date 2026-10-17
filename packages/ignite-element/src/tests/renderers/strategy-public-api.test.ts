import { describe, expect, expectTypeOf, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";

type Strategy = ReturnType<typeof createIgniteJsxRenderStrategy>;

describe("JSX render strategy public API", () => {
	it("exposes the render surface and no internal render counter", () => {
		expectTypeOf<keyof Strategy>().toEqualTypeOf<
			"attach" | "render" | "releaseView" | "detach"
		>();
		expect("renderGeneration" in createIgniteJsxRenderStrategy()).toBe(false);
	});
});
