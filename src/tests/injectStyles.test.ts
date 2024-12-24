import { describe, beforeEach, it, expect, vi, Mock } from "vitest";
import injectStyles from "../injectStyles";
import { getGlobalStyles } from "../globalStyles";
// Mock getGlobalStyles function
vi.mock("../globalStyles", () => ({
  getGlobalStyles: vi.fn(),
}));

describe("injectStyles", () => {
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    // Reset all mocks to ensure clean state
    vi.resetAllMocks();

    // Set up shadow root
    const container = document.createElement("div");
    shadowRoot = container.attachShadow({ mode: "open" });
  });

  it("should inject a valid global CSS string into the shadow DOM", () => {
    (getGlobalStyles as Mock).mockReturnValue("./valid.css");

    injectStyles(shadowRoot);

    const linkElement = shadowRoot.querySelector("link");
    expect(linkElement).toBeTruthy();
    expect(linkElement?.rel).toBe("stylesheet");
    expect(linkElement?.href).toContain("valid.css");
  });

  it("should inject a valid global StyleObject into the shadow DOM", () => {
    (getGlobalStyles as Mock).mockReturnValue({
      href: "./secure-style.css",
      integrity: "sha384-secure123",
      crossorigin: "anonymous",
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
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    (getGlobalStyles as Mock).mockReturnValue("invalidStyle");

    injectStyles(shadowRoot);

    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid global style path:",
      "invalidStyle"
    );

    warnSpy.mockRestore();
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
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const styles = {
      paths: ["invalidStyle"],
    };

    injectStyles(shadowRoot, styles);

    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid style path/object:",
      "invalidStyle"
    );

    warnSpy.mockRestore();
  });

  it("should log a deprecation warning for styles.paths", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const styles = {
      paths: ["./local.css"],
    };

    injectStyles(shadowRoot, styles);

    expect(warnSpy).toHaveBeenCalledWith(
      "DEPRECATION WARNING: `styles.paths` is deprecated. Use `setGlobalStyles` instead."
    );

    warnSpy.mockRestore();
  });

  it("should log a deprecation warning for styles.custom", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const styles = {
      custom: `
        .deprecated-style {
          color: blue;
        }
      `,
    };

    injectStyles(shadowRoot, styles);

    expect(warnSpy).toHaveBeenCalledWith(
      "DEPRECATION WARNING: `styles.custom` is deprecated. Use `setGlobalStyles` instead."
    );

    warnSpy.mockRestore();
  });
});
