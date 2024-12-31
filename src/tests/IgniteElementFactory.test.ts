import igniteElementFactory, { IgniteCore } from "../IgniteElementFactory";
import { TemplateResult } from "lit-html";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MinimalMockAdapter from "./MockAdapter";
import { RenderArgs } from "../RenderArgs";

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

  it("should pause updates when isolated component is disconnected", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent); // Mount component
    document.body.removeChild(isolatedComponent); // Unmount component

    // Verify that the adapter is still active, but updates are paused
    expect(isolatedComponent.isActive).toBe(false); // Uses getter in tests
    expect(adapter.stop).not.toHaveBeenCalled(); // Adapter should NOT be stopped
  });

  it("should resume updates when isolated component is reconnected", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult;
      }
    );

    document.body.appendChild(isolatedComponent); // Connect
    document.body.removeChild(isolatedComponent); // Disconnect
    document.body.appendChild(isolatedComponent); // Reconnect

    // Verify that _isActive is reset
    expect(isolatedComponent.isActive).toBe(true);

    // Verify that rendering has resumed
    expect(isolatedComponent.shadowRoot?.textContent).toBeDefined();
  });

  it("should preserve adapter subscription on reconnection", () => {
    const isolatedComponent = core.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult;
      }
    );

    document.body.appendChild(isolatedComponent); // Connect
    const stateBefore = adapter.getState();
    document.body.removeChild(isolatedComponent); // Disconnect
    document.body.appendChild(isolatedComponent); // Reconnect

    const stateAfter = adapter.getState();
    expect(stateBefore).toEqual(stateAfter); // State remains intact
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

  it("should create a shared component using the Shared decorator", () => {
    @core.Shared(`shared-decorator-${uniqueId}`)
    class SharedCounter {
      render({ state }: RenderArgs<State, Event>): TemplateResult {
        expect(state).toEqual(initialState); // Ensure initial state
        return {} as TemplateResult;
      }
    }

    const sharedComponent = document.createElement(
      `shared-decorator-${uniqueId}`
    );
    document.body.appendChild(sharedComponent);

    // Verify the component exists and is subscribed
    expect(sharedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();

    // Verify shadowRoot is set up
    expect(sharedComponent.shadowRoot).toBeDefined();
  });

  it("should create an isolated component using the Isolated decorator", () => {
    @core.Isolated(`isolated-decorator-${uniqueId}`)
    class IsolatedCounter {
      render({ state }: RenderArgs<State, Event>): TemplateResult {
        expect(state).toEqual(initialState); // Ensure initial state
        return {} as TemplateResult;
      }
    }

    const isolatedComponent = document.createElement(
      `isolated-decorator-${uniqueId}`
    );
    document.body.appendChild(isolatedComponent);

    // Verify the component exists and is subscribed
    expect(isolatedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();

    // Verify shadowRoot is set up
    expect(isolatedComponent.shadowRoot).toBeDefined();
  });
});
