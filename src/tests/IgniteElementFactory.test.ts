import igniteElementFactory from "../IgniteElmentFactory";
import { TemplateResult } from "lit-html";
import { vi } from "vitest";
import MinimalMockAdapter from "./MockAdapter";

describe("IgniteElementFactory", () => {
  const initialState = { count: 0 };
  type State = typeof initialState;
  type Event = { type: string };
  let adapter: MinimalMockAdapter<State, Event>;
  let factory: ReturnType<typeof igniteElementFactory<State, Event>>;
  let uniqueId: number;

  beforeEach(() => {
    uniqueId = Math.random();
    adapter = new MinimalMockAdapter(initialState);
    factory = igniteElementFactory(() => adapter);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("should create shared components and subscribe to adapter", () => {
    const sharedComponent = factory.shared(
      `shared-counter-${uniqueId}`,
      (state) => {
        expect(state).toEqual(initialState);
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    expect(sharedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it("should create isolated components and subscribe to adapter", () => {
    const isolatedComponent = factory.isolated(
      `isolated-counter-${uniqueId}`,
      (state) => {
        expect(state).toEqual(initialState);
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent);

    expect(isolatedComponent).toBeDefined();
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it("should initialize adapter during connectedCallback", () => {
    const isolatedComponent = factory.isolated(
      `isolated-counter-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(isolatedComponent);

    expect(adapter.subscribe).toHaveBeenCalledTimes(1);
  });

  it("should call stop on isolated component disconnection", () => {
    const isolatedComponent = factory.isolated(
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
    const styledFactory = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = styledFactory.shared(
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
    const styledFactory = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = styledFactory.shared(
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
    const styledFactory = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = styledFactory.shared(
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
      paths: [42, { invalidProp: "invalidValue" }],
    };
    // @ts-expect-error numbers are not valid styles
    const styledFactory = igniteElementFactory(() => adapter, { styles });

    const sharedComponent = styledFactory.shared(
      `shared-styled-invalid-${uniqueId}`,
      () => {
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", 42);
    expect(warnSpy).toHaveBeenCalledWith("Invalid style path/object:", {
      invalidProp: "invalidValue",
    });

    warnSpy.mockRestore();
  });

  it("should call the send method from render", () => {
    const event = { type: "increment" };
    const sharedComponent = factory.shared(
      `shared-send-test-${uniqueId}`,
      (_, send) => {
        send(event);
        return {} as TemplateResult; // Mock TemplateResult
      }
    );

    document.body.appendChild(sharedComponent);
    expect(adapter.send).toHaveBeenCalledWith(event);

    const isolatedComponent = factory.isolated(
      "isolated-send-test",
      (_, send) => {
        send(event);
        return {} as TemplateResult;
      }
    );

    isolatedComponent.connectedCallback();
    expect(adapter.send).toHaveBeenCalledWith(event);
  });
});
