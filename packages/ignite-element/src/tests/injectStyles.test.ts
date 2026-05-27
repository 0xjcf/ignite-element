import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setGlobalStyles } from "../globalStyles";
import injectStyles, { flushPendingStyles } from "../injectStyles";

describe("injectStyles", () => {
	let shadowRoot: ShadowRoot;
	let warnSpy: MockInstance<typeof console.warn>;

	const createShadowRoot = () => {
		const element = document.createElement(`test-component-${Math.random()}`);
		return element.attachShadow({ mode: "open" });
	};

	beforeEach(() => {
		// Create fresh shadow root with unique component name for each test
		shadowRoot = createShadowRoot();

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

	it("skips string .scss stylesheets and warns", () => {
		setGlobalStyles("./theme.scss");

		injectStyles(shadowRoot);

		expect(shadowRoot.querySelector("link")).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			"Skipping non-browser stylesheet path:",
			"./theme.scss",
		);
	});

	it("skips StyleObject .scss stylesheets after a pending flush and keeps roots deduped", () => {
		injectStyles(shadowRoot);
		setGlobalStyles({
			href: "./theme.scss",
			crossOrigin: "anonymous",
		});

		flushPendingStyles();
		flushPendingStyles();

		expect(shadowRoot.querySelectorAll("link")).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith(
			"Skipping non-browser stylesheet path:",
			"./theme.scss",
		);
	});

	it("keeps pending roots retryable after rejected stylesheet flushes and injects late valid css once per root", () => {
		const secondRoot = createShadowRoot();

		injectStyles(shadowRoot);
		injectStyles(secondRoot);
		setGlobalStyles("./theme.scss");

		flushPendingStyles();
		flushPendingStyles();

		expect(shadowRoot.querySelectorAll("link")).toHaveLength(0);
		expect(secondRoot.querySelectorAll("link")).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledTimes(1);

		setGlobalStyles("./theme.css");
		flushPendingStyles();
		flushPendingStyles();

		const links = shadowRoot.querySelectorAll("link");
		const secondLinks = secondRoot.querySelectorAll("link");
		expect(links).toHaveLength(1);
		expect(secondLinks).toHaveLength(1);
		expect(links[0]?.href).toContain("theme.css");
		expect(secondLinks[0]?.href).toContain("theme.css");
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
