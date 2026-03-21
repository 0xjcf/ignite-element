import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setGlobalStyles } from "../globalStyles";
import injectStyles from "../injectStyles";

describe("injectStyles", () => {
	let shadowRoot: ShadowRoot;
	let warnSpy: MockInstance<typeof console.warn>;

	beforeEach(() => {
		// Create fresh shadow root with unique component name for each test
		const element = document.createElement(`test-component-${Math.random()}`);
		shadowRoot = element.attachShadow({ mode: "open" });

		// Set up warn spy fresh for each test
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up
		warnSpy.mockRestore();
		setGlobalStyles(undefined);
		vi.restoreAllMocks();
	});

	it("should inject a valid global StyleObject into the shadow DOM", () => {
		setGlobalStyles({
			href: "./secure-style.css",
			integrity: "sha384-secure123",
			crossOrigin: "anonymous",
		});

		injectStyles(shadowRoot);

		const linkElement = shadowRoot.querySelector("link");
		expect(linkElement).toBeTruthy();
		if (!linkElement) {
			throw new Error("Expected stylesheet link to be injected.");
		}
		expect(linkElement?.rel).toBe("stylesheet");
		expect(linkElement?.href).toContain("secure-style.css");
		expect(linkElement?.integrity).toBe("sha384-secure123");
		expect(linkElement?.crossOrigin).toBe("anonymous");
	});

	it("should log a warning for invalid global styles", () => {
		setGlobalStyles("invalidStyle");

		injectStyles(shadowRoot);

		expect(warnSpy).toHaveBeenCalledWith(
			"Invalid global style path:",
			"invalidStyle",
		);
	});

	it("should ignore redundant calls for the same shadow root", () => {
		setGlobalStyles({
			href: "./theme.css",
		});

		injectStyles(shadowRoot);
		injectStyles(shadowRoot);

		const links = shadowRoot.querySelectorAll("link");
		expect(links).toHaveLength(1);
	});
});
