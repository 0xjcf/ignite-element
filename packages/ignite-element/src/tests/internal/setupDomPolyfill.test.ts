// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("DOM initialization boundary (retired polyfill)", () => {
	it("imports the internal class module without evaluating HTMLElement inheritance", async () => {
		expect(typeof HTMLElement).toBe("undefined");
		await import("../../IgniteElement");
		expect(typeof HTMLElement).toBe("undefined");
		expect(typeof customElements).toBe("undefined");
	});
	it("constructs a root registrar but rejects DOM registration synchronously", async () => {
		const { igniteCore } = await import("../../index");
		const core = igniteCore();
		expect(() => core("no-browser", () => null)).toThrow(/DOM registration/);
		expect(typeof HTMLElement).toBe("undefined");
		expect(typeof customElements).toBe("undefined");
	});
});
