import igniteElementFactory, { IgniteCore } from "../IgniteElementFactory";
import { TemplateResult } from "lit-html";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MinimalMockAdapter from "./MockAdapter";

describe("IgniteElementFactory", () => {
  const initialState = { count: 0 };
  type State = typeof initialState;
  type Event = { type: string };
  let adapter: MinimalMockAdapter<State, Event>;
  let core: IgniteCore<State, Event>;
  let uniqueId: number;

  beforeEach(() => {
    uniqueId = Math.random();
    adapter = new MinimalMockAdapter(initialState);
    core = igniteElementFactory(() => adapter);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("should create shared components and subscribe to adapter", () => {
    const sharedComponent = core.shared(
      `shared-counter-${uniqueId}`,
      ({ state }) => {
        expect(state).toEqual(initialState);
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    expect(sharedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it("should create isolated components and subscribe to adapter", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      ({ state }) => {
        expect(state).toEqual(initialState);
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent);

    expect(isolatedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it("should initialize adapter during connectedCallback", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent);

    expect(adapter.subscribe).toHaveBeenCalledTimes(1);
  });

  it("should call stop on isolated component disconnection", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent);
    document.body.removeChild(isolatedComponent);

    expect(adapter.stop).toHaveBeenCalledTimes(1);
  });

  it("should inject custom styles into the shadow DOM", () => {
    const styles = { custom: "div { color: red; }" };
    const core = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = core.shared(
      `shared-styled-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    const shadowRoot = sharedComponent.shadowRoot;
    const styleElement = shadowRoot?.querySelector("style");

    expect(styleElement).toBeDefined();
    expect(styleElement?.textContent).toContain(styles.custom);
  });

  it("should inject external stylesheet paths into the shadow DOM", () => {
    const styles = {
      paths: [
        "https://example.com/styles.css",
        { href: "https://example.com/other-styles.css", integrity: "abc123" },
      ],
    };
    const core = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = core.shared(
      `shared-styled-paths-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    const shadowRoot = sharedComponent.shadowRoot;
    const linkElements = shadowRoot?.querySelectorAll("link");

    expect(linkElements?.length).toBe(2);
    expect(linkElements?.[0].href).toBe("https://example.com/styles.css");
    expect(linkElements?.[1].href).toBe("https://example.com/other-styles.css");
    expect(linkElements?.[1].integrity).toBe("abc123");
  });

  it("should inject external stylesheet with crossorigin into the shadow DOM", () => {
    const styles = {
      paths: [
        {
          href: "https://example.com/secure-styles.css",
          integrity: "sha256-123",
          crossorigin: "anonymous",
        },
      ],
    };
    const core = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = core.shared(
      `shared-styled-crossorigin-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    const shadowRoot = sharedComponent.shadowRoot;
    const linkElement = shadowRoot?.querySelector("link");

    expect(linkElement).toBeDefined();
    expect(linkElement?.href).toBe("https://example.com/secure-styles.css");
    expect(linkElement?.integrity).toBe("sha256-123");
    expect(linkElement?.crossOrigin).toBe("anonymous");
  });

  it("should log a warning for invalid style paths", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const styles = {
      paths: [42, { invalidProp: "invalidValue" }, "./valid.css"],
    };

    // @ts-expect-error numbers are not valid styles
    const core = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = core.shared(
      `shared-styled-invalid-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    // Expect warnings for invalid styles
    expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", 42);
    expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", {
      invalidProp: "invalidValue",
    });

    // Ensure valid styles are not logged as warnings
    expect(warnSpy).not.toHaveBeenCalledWith(
      "Invalid style path/object:",
      "./valid.css"
    );

    warnSpy.mockRestore();
  });
});
