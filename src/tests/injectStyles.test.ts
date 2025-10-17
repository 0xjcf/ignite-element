import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
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
		(getGlobalStyles as Mock).mockReturnValue({
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
		(getGlobalStyles as Mock).mockReturnValue("invalidStyle");

		injectStyles(shadowRoot);

		expect(warnSpy).toHaveBeenCalledWith(
			"Invalid global style path:",
			"invalidStyle",
		);
	});

	it("should inject valid .scss file from styles.paths into the shadow DOM", () => {
		const styles = {
			paths: ["./local.scss"],
		};

		injectStyles(shadowRoot, styles);

		const linkElement = shadowRoot.querySelector("link");
		expect(linkElement).toBeTruthy();
		expect(linkElement?.rel).toBe("stylesheet");
		expect(linkElement?.href).toContain("local.scss");
	});

	it("should log a warning for invalid styles in styles.paths", () => {
		const styles = {
			paths: ["invalidStyle"],
		};

		injectStyles(shadowRoot, styles);

		expect(warnSpy).toHaveBeenCalledWith(
			"Invalid style path/object:",
			"invalidStyle",
		);
	});

	it("should log a deprecation warning for styles.paths", () => {
		const styles = {
			paths: ["./local.css"],
		};

		injectStyles(shadowRoot, styles);

		expect(warnSpy).toHaveBeenCalledWith(
			"DEPRECATION WARNING: `styles.paths` is deprecated. Use `setGlobalStyles` instead.",
		);
	});

	it("should log a deprecation warning for styles.custom", () => {
		const styles = {
			custom: `
        .deprecated-style {
          color: blue;
        }
      `,
		};

		injectStyles(shadowRoot, styles);

		expect(warnSpy).toHaveBeenCalledWith(
			"DEPRECATION WARNING: `styles.custom` is deprecated. Use `setGlobalStyles` instead.",
		);
	});
});
