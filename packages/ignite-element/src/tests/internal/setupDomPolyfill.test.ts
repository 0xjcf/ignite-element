import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modulePath = "../../internal/setupDomPolyfill";

type TestGlobal = typeof globalThis & {
	HTMLElement?: typeof HTMLElement;
	customElements?: CustomElementRegistry;
};

const testGlobal = globalThis as TestGlobal;
const baselineHTMLElement = Object.getOwnPropertyDescriptor(
	testGlobal,
	"HTMLElement",
);
const baselineCustomElements = Object.getOwnPropertyDescriptor(
	testGlobal,
	"customElements",
);

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	if (baselineHTMLElement) {
		Object.defineProperty(testGlobal, "HTMLElement", baselineHTMLElement);
	} else {
		Reflect.deleteProperty(testGlobal, "HTMLElement");
	}

	if (baselineCustomElements) {
		Object.defineProperty(testGlobal, "customElements", baselineCustomElements);
	} else {
		Reflect.deleteProperty(testGlobal, "customElements");
	}
});

describe("setupDomPolyfill", () => {
	it("stubs HTMLElement when missing", async () => {
		const original = Object.getOwnPropertyDescriptor(testGlobal, "HTMLElement");
		Reflect.deleteProperty(testGlobal, "HTMLElement");

		await import(modulePath);
		expect(testGlobal.HTMLElement).toBeDefined();
		const instance = new (testGlobal.HTMLElement as typeof HTMLElement)();
		const shadow = instance.attachShadow({ mode: "open" });
		expect(shadow.host).toBe(instance);

		if (original) {
			Object.defineProperty(testGlobal, "HTMLElement", original);
		}
	});

	it("stubs customElements when missing", async () => {
		const original = Object.getOwnPropertyDescriptor(
			testGlobal,
			"customElements",
		);
		Reflect.deleteProperty(testGlobal, "customElements");

		await import(modulePath);
		expect(testGlobal.customElements).toBeDefined();
		expect(typeof testGlobal.customElements?.define).toBe("function");
		expect(typeof testGlobal.customElements?.get).toBe("function");
		expect(typeof testGlobal.customElements?.getName).toBe("function");
		expect(typeof testGlobal.customElements?.upgrade).toBe("function");
		expect(testGlobal.customElements?.get("x-tag")).toBeUndefined();
		const DummyCtor = class extends (testGlobal.HTMLElement ?? HTMLElement) {};
		expect(testGlobal.customElements?.getName?.(DummyCtor)).toBeNull();
		const node = document.createElement("div");
		expect(() => testGlobal.customElements?.upgrade?.(node)).not.toThrow();
		await expect(
			testGlobal.customElements?.whenDefined("x-tag"),
		).resolves.toBeDefined();

		if (original) {
			Object.defineProperty(testGlobal, "customElements", original);
		}
	});

	it("whenDefined falls back if HTMLElement disappears later", async () => {
		Reflect.deleteProperty(testGlobal, "HTMLElement");
		Reflect.deleteProperty(testGlobal, "customElements");
		await import(modulePath);

		// Remove HTMLElement after polyfill initialization to exercise the fallback branch.
		Reflect.deleteProperty(testGlobal, "HTMLElement");
		const result = await testGlobal.customElements?.whenDefined("x-tag");
		expect(result).toBeDefined();
	});

	it("is idempotent when DOM APIs already exist", async () => {
		const originalHTMLElement = testGlobal.HTMLElement;
		const originalCustomElements = testGlobal.customElements;

		await import(modulePath);

		expect(testGlobal.HTMLElement).toBe(originalHTMLElement);
		expect(testGlobal.customElements).toBe(originalCustomElements);
	});
});
