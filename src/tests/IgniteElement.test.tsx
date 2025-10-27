/** @jsxImportSource ../renderers/jsx */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StateScope } from "../IgniteAdapter";
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

		component(elementName, ({ state, send }) => (
			<div>
				Count: {state?.count}
				<button type="button" onClick={() => send({ type: "increment" })}>
					Increment
				</button>
			</div>
		));

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

	it("should pass the event object when CustomEvent detail is missing", () => {
		const sendSpy = vi.spyOn(adapter, "send");
		const customEvent = new CustomEvent("send");

		element.dispatchEvent(customEvent);

		expect(sendSpy).toHaveBeenCalledWith(customEvent);
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

	it("resubscribes to the adapter when reconnected", () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter);
		const name = `ignite-reconnect-element-${crypto.randomUUID()}`;

		sharedComponent(name, ({ state }) => <div>Count: {state?.count}</div>);

		const reconnectElement = document.createElement(name);
		assertIgniteElement<State, Event>(reconnectElement);
		document.body.appendChild(reconnectElement);

		const subscribeCalls = sharedAdapter.subscribe.mock.calls.length;

		reconnectElement.remove();

		reconnectElement.connectedCallback();

		expect(sharedAdapter.subscribe).toHaveBeenCalledTimes(subscribeCalls + 1);
	});

	it("stops shared adapters when the last instance disconnects", () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter);
		const sharedName = `ignite-shared-element-${crypto.randomUUID()}`;

		sharedComponent(sharedName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const sharedElement = document.createElement(sharedName);
		assertIgniteElement<State, Event>(sharedElement);
		document.body.appendChild(sharedElement);

		sharedElement.remove();

		expect(sharedAdapter.stop).toHaveBeenCalledTimes(1);
		expect(sharedAdapter.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("does not stop shared adapters while other instances remain connected", () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter);
		const sharedName = `ignite-shared-multi-${crypto.randomUUID()}`;

		sharedComponent(sharedName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const firstElement = document.createElement(sharedName);
		const secondElement = document.createElement(sharedName);
		assertIgniteElement<State, Event>(firstElement);
		assertIgniteElement<State, Event>(secondElement);

		document.body.append(firstElement, secondElement);
		expect(createSharedAdapter).toHaveBeenCalledTimes(1);

		firstElement.remove();
		expect(sharedAdapter.stop).not.toHaveBeenCalled();

		secondElement.remove();
		expect(createSharedAdapter).toHaveBeenCalledTimes(1);
		expect(sharedAdapter.stop).toHaveBeenCalledTimes(1);
	});

	it("allows opting out of shared lifecycle management", () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter, {
			cleanup: false,
		});
		const sharedName = `ignite-shared-manual-${crypto.randomUUID()}`;

		sharedComponent(sharedName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const sharedElement = document.createElement(sharedName);
		assertIgniteElement<State, Event>(sharedElement);
		document.body.appendChild(sharedElement);

		sharedElement.remove();

		expect(sharedAdapter.stop).not.toHaveBeenCalled();
		expect(sharedAdapter.unsubscribe).toHaveBeenCalledTimes(1);
	});
});
