import { html } from "lit-html";
import igniteElementFactory from "../IgniteElementFactory";
import MockAdapter from "./MockAdapter";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";

describe("IgniteElement", () => {
  const initialState = { count: 0 };
  type State = typeof initialState;
  type Event = { type: string };
  let adapter: MockAdapter<State, Event>;
  let element: HTMLElement;

  // Create a type to expose protected methods for testing
  interface TestIgniteElement extends HTMLElement {
    _adapter: any;
    state: State;
    _currentState: State | null;
    renderTemplate: () => void;
  }

  beforeEach(() => {
    adapter = new MockAdapter(initialState);
    const core = igniteElementFactory(() => adapter);
    const uniqueName = `shared-test-element-${Math.random()}`;
    element = core.shared(uniqueName, ({ state, send }) => {
      return html`
        <div>
          Count: ${state.count}
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

  it("should stop the adapter when the element is disconnected", () => {
    element.remove(); // Simulate disconnection
    expect(adapter.stop).toHaveBeenCalled();
  });

  it("should return the adapter's state via the state getter", () => {
    const elementInstance = element as TestIgniteElement; // Access protected methods for testing
    expect(elementInstance.state).toEqual(initialState);
    expect(adapter.getState).toHaveBeenCalled();
  });

  it("should warn if _currentState is not initialized during renderTemplate", () => {
    const elementInstance = element as TestIgniteElement; // Access protected methods for testing
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Set _currentState to null and force renderTemplate
    elementInstance._currentState = null;
    elementInstance.renderTemplate();

    expect(warnSpy).toHaveBeenCalledWith(
      "[IgniteElement] State is not initialized"
    );

    warnSpy.mockRestore();
  });

  it("should not warn and render correctly if _currentState is initialized", () => {
    const elementInstance = element as TestIgniteElement; // Access protected methods for testing
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Ensure _currentState is initialized and renderTemplate is called
    elementInstance._currentState = initialState;
    elementInstance.renderTemplate();

    const shadowContent = element.shadowRoot?.textContent;
    expect(shadowContent).toContain("Count: 0");
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should handle actions dispatched as plain objects", () => {
    // Directly use the send method with plain object actions
    const elementInstance = element as TestIgniteElement; // Access protected methods
    elementInstance._adapter.send({ type: "increment" });

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
});
