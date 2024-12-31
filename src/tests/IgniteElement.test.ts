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

  // Create a type to expose protected methods for testing
  interface TestIgniteElement extends IgniteElement<State, Event> {}

  beforeEach(() => {
    adapter = new MockAdapter(initialState);
    const core = igniteElementFactory(() => adapter);
    const uniqueName = `shared-test-element-${Math.random()}`;
    element = core.shared(uniqueName, ({ state, send }) => {
      return html`
        <div>
          Count: ${state?.count}
          <button @click=${() => send({ type: "increment" })}>Increment</button>
        </div>
      `;
    });

    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
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
    expect(element.isActive).toBe(false); // Ensure _isActive is set to false
  });

  it("should return the adapter's state via the state getter", () => {
    const elementInstance = element as TestIgniteElement; // Access protected methods for testing
    expect(elementInstance.currentState).toEqual(initialState);
    expect(adapter.getState).toHaveBeenCalled();
  });

  it("should handle actions dispatched as plain objects", () => {
    // Directly use the send method with plain object actions
    const elementInstance = element as TestIgniteElement; // Access protected methods
    elementInstance.adapter?.send({ type: "increment" });

    // Verify adapter received the expected action
    expect(adapter.send).toHaveBeenCalledWith({ type: "increment" });
  });

  it("should capture and validate the dispatchEvent call", () => {
    const eventListener = vi.fn(); // Mock listener

    // Attach a listener to the element
    element.addEventListener("send", eventListener);

    // Dispatch the event
    const customEvent = new CustomEvent("send", {
      detail: { type: "increment" },
    });
    element.dispatchEvent(customEvent);

    // Assert that the listener was called
    expect(eventListener).toHaveBeenCalled();
    expect(eventListener).toHaveBeenCalledWith(expect.any(CustomEvent));
  });

  it("should handle actions dispatched as CustomEvent", () => {
    const sendSpy = vi.spyOn(adapter, "send");
    // Create a custom event with payload
    const customEvent = new CustomEvent("send", {
      detail: { type: "increment" },
    });

    element.dispatchEvent(customEvent); // Dispatch the event

    // Verify that the adapter received the expected action
    expect(sendSpy).toHaveBeenCalledWith({ type: "increment" });
  });

  it("should render correctly using forceRender when initialized and active", () => {
    const elementInstance = element as TestIgniteElement;

    // Simulate initialized and active state
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

    // Simulate uninitialized state
    (elementInstance as any).initialized = false;
    elementInstance.forceRender();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] Attempted to force render before initialization."
    );

    warnSpy.mockRestore();
  });

  it("should warn if forceRender is called while inactive", () => {
    const elementInstance = element as TestIgniteElement;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Simulate inactive state
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

    // Simulate inactive state
    elementInstance.currentState = undefined;
    elementInstance.forceRender();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] State is not initialized"
    );

    expect(elementInstance.initialized).toBe(true);

    warnSpy.mockRestore();
  });
});
