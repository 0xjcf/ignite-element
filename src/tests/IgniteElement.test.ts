import { html } from "lit-html";
import igniteElementFactory from "../IgniteElementFactory";
import MockAdapter from "./MockAdapter";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import IgniteElement from "../IgniteElement";

describe("IgniteElement", () => {
  const initialState = { count: 0 };
  type State = typeof initialState | undefined;
  type Event = { type: string };
  let adapter: MockAdapter<State, Event>;
  let element: IgniteElement<State, Event>;
  let elementName: string;

  // Create a type to expose protected methods for testing
  interface TestIgniteElement extends IgniteElement<State, Event> {}

  beforeEach(() => {
    adapter = new MockAdapter(initialState);
    const core = igniteElementFactory(() => adapter);
    elementName = `shared-test-element-${crypto.randomUUID()}`;
    
    // Define the element
    core.shared(elementName, ({ state, send }) => {
      return html`
        <div>
          Count: ${state?.count}
          <button @click=${() => send({ type: "increment" })}>Increment</button>
        </div>
      `;
    });

    // Create and append element
    element = document.createElement(elementName) as IgniteElement<State, Event>;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element?.isConnected) {
      document.body.removeChild(element);
    }
  });

  it("should render the initial state in the DOM", () => {
    const shadowContent = element.shadowRoot?.textContent;
    expect(shadowContent).toContain("Count: 0");
  });

  it("should call the adapter's send method when a button is clicked", () => {
    const button = element.shadowRoot?.querySelector("button");
    button?.click();

    expect(adapter.send).toHaveBeenCalledWith({ type: "increment" });
  });

  it("should update the DOM when the state changes", () => {
    // Simulate a state update
    adapter.subscribe.mock.calls[0][0]({ count: 1 }); // Call listener with new state
    const shadowContent = element.shadowRoot?.textContent;
    expect(shadowContent).toContain("Count: 1");
  });

  it("should pause updates (set _isActive to false) when the element is disconnected", () => {
    element.remove(); // Simulate disconnection
    expect((element as TestIgniteElement).isActive).toBe(false);
  });

  it("should return the adapter's state via the state getter", () => {
    const elementInstance = element as TestIgniteElement;
    expect(elementInstance.currentState).toEqual(initialState);
    expect(adapter.getState).toHaveBeenCalled();
  });

  it("should handle actions dispatched as plain objects", () => {
    const elementInstance = element as TestIgniteElement;
    elementInstance.adapter?.send({ type: "increment" });

    expect(adapter.send).toHaveBeenCalledWith({ type: "increment" });
  });

  it("should capture and validate the dispatchEvent call", () => {
    const eventListener = vi.fn();
    element.addEventListener("send", eventListener);

    const customEvent = new CustomEvent("send", {
      detail: { type: "increment" },
    });
    element.dispatchEvent(customEvent);

    expect(eventListener).toHaveBeenCalled();
    expect(eventListener).toHaveBeenCalledWith(expect.any(CustomEvent));
  });

  it("should handle actions dispatched as CustomEvent", () => {
    const sendSpy = vi.spyOn(adapter, "send");
    const customEvent = new CustomEvent("send", {
      detail: { type: "increment" },
    });

    element.dispatchEvent(customEvent);

    expect(sendSpy).toHaveBeenCalledWith({ type: "increment" });
  });

  it("should render correctly using forceRender when initialized and active", () => {
    const elementInstance = element as TestIgniteElement;
    elementInstance.initialized = true;
    elementInstance.isActive = true;
    elementInstance.currentState = { count: 0 };

    const renderSpy = vi.spyOn(elementInstance, "forceRender");
    elementInstance.forceRender();

    const shadowContent = element.shadowRoot?.textContent;
    expect(shadowContent).toContain("Count: 0");
    expect(renderSpy).toHaveBeenCalled();
  });

  it("should warn if forceRender is called before initialization", () => {
    const elementInstance = element as TestIgniteElement;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    elementInstance.initialized = false;
    elementInstance.forceRender();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] Attempted to force render before initialization."
    );

    warnSpy.mockRestore();
  });

  it("should warn if forceRender is called while inactive", () => {
    const elementInstance = element as TestIgniteElement;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    elementInstance.isActive = false;
    elementInstance.initialized = true;
    elementInstance.forceRender();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] Attempted to force render while inactive."
    );

    warnSpy.mockRestore();
  });

  it("should warn if currentState is undefined", () => {
    const elementInstance = element as TestIgniteElement;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    elementInstance.currentState = undefined;
    elementInstance.forceRender();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] State is not initialized"
    );

    expect(elementInstance.initialized).toBe(true);

    warnSpy.mockRestore();
  });
});
