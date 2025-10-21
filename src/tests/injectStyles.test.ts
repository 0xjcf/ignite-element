import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalStyles } from "../globalStyles";
import injectStyles from "../injectStyles";

// Mock getGlobalStyles
vi.mock("../globalStyles");

describe("injectStyles", () => {
	let shadowRoot: ShadowRoot;
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Reset all mocks and modules
		vi.resetModules();
		vi.resetAllMocks();
		vi.clearAllMocks();

		// Create fresh shadow root with unique component name for each test
		const element = document.createElement(`test-component-${Math.random()}`);
		shadowRoot = element.attachShadow({ mode: "open" });

		// Set up warn spy fresh for each test
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up
		warnSpy.mockRestore();
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("should inject a valid global StyleObject into the shadow DOM", () => {
		vi.mocked(getGlobalStyles).mockReturnValue({
			href: "./secure-style.css",
			integrity: "sha384-secure123",
			crossOrigin: "anonymous",
		});

		injectStyles(shadowRoot);

		const linkElement = shadowRoot.querySelector("link");
		expect(linkElement).toBeTruthy();
		expect(linkElement?.rel).toBe("stylesheet");
		expect(linkElement?.href).toContain("secure-style.css");
		expect(linkElement?.integrity).toBe("sha384-secure123");
		expect(linkElement?.crossOrigin).toBe("anonymous");
	});

	it("should log a warning for invalid global styles", () => {
		vi.mocked(getGlobalStyles).mockReturnValue("invalidStyle");

		injectStyles(shadowRoot);

		expect(warnSpy).toHaveBeenCalledWith(
			"Invalid global style path:",
			"invalidStyle",
		);
	});

	it("should ignore redundant calls for the same shadow root", () => {
		vi.mocked(getGlobalStyles).mockReturnValue({
			href: "./theme.css",
		});

		injectStyles(shadowRoot);
		injectStyles(shadowRoot);

		const links = shadowRoot.querySelectorAll("link");
		expect(links).toHaveLength(1);
	});
});
