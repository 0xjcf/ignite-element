import { html } from "lit-html";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IgniteElement from "../IgniteElement";
import igniteElementFactory from "../IgniteElementFactory";
import MockAdapter from "./MockAdapter";

function assertIgniteElement<State, Event>(
	element: Element,
): asserts element is IgniteElement<State, Event> {
	expect(element).toBeInstanceOf(IgniteElement);
}

describe("IgniteElement", () => {
	const initialState = { count: 0 };
	type State = typeof initialState | undefined;
	type Event = { type: string };
	let adapter: MockAdapter<State, Event>;
	let element: IgniteElement<State, Event>;
	let elementName: string;

	beforeEach(() => {
		adapter = new MockAdapter(initialState);
		const component = igniteElementFactory(() => adapter);
		elementName = `ignite-test-element-${crypto.randomUUID()}`;

		component(elementName, ({ state, send }) => {
			return html`
        <div>
          Count: ${state?.count}
          <button @click=${() => send({ type: "increment" })}>Increment</button>
        </div>
      `;
		});

		// Create and append element
		const createdElement = document.createElement(elementName);
		assertIgniteElement<State, Event>(createdElement);
		element = createdElement;
		document.body.appendChild(element);
	});

	afterEach(() => {
		if (element?.isConnected) {
			document.body.removeChild(element);
		}
		vi.clearAllMocks();
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
		expect(element.isActive).toBe(false);
	});

	it("should unsubscribe and stop the adapter when disconnected", () => {
		element.remove();

		expect(adapter.unsubscribe).toHaveBeenCalledTimes(1);
		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});

	it("should not send events when inactive", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		element.remove();

		// @ts-expect-error - accessing protected method to verify inactive warning.
		element.send(new CustomEvent("send", { detail: { type: "increment" } }));

		expect(warnSpy).toHaveBeenCalledWith(
			"[IgniteElement] Cannot send events while inactive.",
		);
		expect(adapter.send).not.toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it("should return the adapter's state via the state getter", () => {
		expect(element.currentState).toEqual(initialState);
		expect(adapter.getState).toHaveBeenCalled();
	});

	it("should handle actions dispatched as plain objects", () => {
		element.adapter?.send({ type: "increment" });

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
		element.initialized = true;
		element.isActive = true;
		element.currentState = { count: 0 };

		const renderSpy = vi.spyOn(element, "forceRender");
		element.forceRender();

		const shadowContent = element.shadowRoot?.textContent;
		expect(shadowContent).toContain("Count: 0");
		expect(renderSpy).toHaveBeenCalled();
	});

	it("should warn if forceRender is called before initialization", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		element.initialized = false;
		element.forceRender();

		expect(warnSpy).toHaveBeenCalledWith(
			"[IgniteElement] Attempted to force render before initialization.",
		);

		warnSpy.mockRestore();
	});

	it("should warn if forceRender is called while inactive", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		element.isActive = false;
		element.initialized = true;
		element.forceRender();

		expect(warnSpy).toHaveBeenCalledWith(
			"[IgniteElement] Attempted to force render while inactive.",
		);

		warnSpy.mockRestore();
	});

	it("should warn if currentState is undefined", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		element.currentState = undefined;
		element.forceRender();

		expect(warnSpy).toHaveBeenCalledWith(
			"[IgniteElement] State is not initialized",
		);

		expect(element.initialized).toBe(true);

		warnSpy.mockRestore();
	});
});
