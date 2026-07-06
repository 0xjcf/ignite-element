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

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

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
		adapter.subscribeSnapshots.mock.calls[0][0]({ count: 1 }); // Call listener with new state
		const shadowContent = element.shadowRoot?.textContent;
		expect(shadowContent).toContain("Count: 1");
	});

	it("should pause updates (set _isActive to false) when the element is disconnected", () => {
		element.remove(); // Simulate disconnection
		expect(element.isActive).toBe(false);
	});

	it("should unsubscribe and stop the adapter when disconnected", async () => {
		element.remove();

		expect(adapter.unsubscribe).toHaveBeenCalledTimes(1);
		await flushMicrotasks();
		expect(adapter.stop).toHaveBeenCalledTimes(1);
	});

	it("should render snapshots emitted during the move window after reconnect", async () => {
		const subscriptionListener = adapter.subscribeSnapshots.mock.calls[0][0];

		element.remove();
		adapter.getSnapshot.mockReturnValue({ count: 2 });
		subscriptionListener({ count: 2 });
		document.body.appendChild(element);

		expect(adapter.unsubscribe).toHaveBeenCalledTimes(1);
		expect(adapter.stop).not.toHaveBeenCalled();
		expect(element.shadowRoot?.textContent).toContain("Count: 2");

		element.remove();
		await flushMicrotasks();
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
		expect(adapter.getSnapshot).toHaveBeenCalled();
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

	// forceRender was removed at stable v3 (T7; it had carried "TODO: REMOVE
	// in v2.0" since the v1->v2 era). Pin the removal.
	it("no longer exposes forceRender", () => {
		// @ts-expect-error -- forceRender was removed at stable v3.
		expect(element.forceRender).toBeUndefined();
	});

	it("should warn instead of rendering when state is not initialized", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// A state update arriving while initialization is unwound hits the
		// render guard through the adapter subscription path.
		element.initialized = false;
		adapter.subscribeSnapshots.mock.calls[0][0]({ count: 1 });

		expect(warnSpy).toHaveBeenCalledWith(
			"[IgniteElement] State is not initialized",
		);

		warnSpy.mockRestore();
	});

	it("renders falsy primitive states once initialized", () => {
		type PrimitiveState = "" | false | number;
		const primitiveAdapter = new MockAdapter<PrimitiveState, Event>(0);
		const component = igniteElementFactory(() => primitiveAdapter);
		const name = `ignite-falsy-state-${crypto.randomUUID()}`;

		component(name, ({ state }) => <div>Value: {String(state)}</div>);

		const primitiveElement = document.createElement(name);
		assertIgniteElement<PrimitiveState, Event>(primitiveElement);
		document.body.appendChild(primitiveElement);

		expect(primitiveElement.shadowRoot?.textContent).toContain("Value: 0");

		primitiveAdapter.subscribeSnapshots.mock.calls[0][0](false);
		expect(primitiveElement.shadowRoot?.textContent).toContain("Value: false");

		primitiveAdapter.subscribeSnapshots.mock.calls[0][0]("");
		expect(primitiveElement.shadowRoot?.textContent).toContain("Value:");

		primitiveElement.remove();
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

		const subscribeCalls = sharedAdapter.subscribeSnapshots.mock.calls.length;

		reconnectElement.remove();

		reconnectElement.connectedCallback();

		expect(sharedAdapter.subscribeSnapshots).toHaveBeenCalledTimes(
			subscribeCalls + 1,
		);
	});

	it("stops shared adapters on last disconnect when cleanup:true is set", async () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter, {
			cleanup: true,
		});
		const sharedName = `ignite-shared-element-${crypto.randomUUID()}`;

		sharedComponent(sharedName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const sharedElement = document.createElement(sharedName);
		assertIgniteElement<State, Event>(sharedElement);
		document.body.appendChild(sharedElement);

		sharedElement.remove();

		await flushMicrotasks();
		expect(sharedAdapter.stop).toHaveBeenCalledTimes(1);
		expect(sharedAdapter.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("does not stop shared adapters while other instances remain connected (cleanup:true)", async () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter, {
			cleanup: true,
		});
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
		await flushMicrotasks();
		expect(sharedAdapter.stop).not.toHaveBeenCalled();

		secondElement.remove();
		await flushMicrotasks();
		expect(createSharedAdapter).toHaveBeenCalledTimes(1);
		expect(sharedAdapter.stop).toHaveBeenCalledTimes(1);
	});

	it("keeps shared (consumer-owned) adapters alive on disconnect by default", async () => {
		const sharedAdapter = new MockAdapter(initialState, StateScope.Shared);
		const createSharedAdapter = Object.assign(
			vi.fn(() => sharedAdapter),
			{
				scope: StateScope.Shared as const,
			},
		);
		const sharedComponent = igniteElementFactory(createSharedAdapter);
		const sharedName = `ignite-shared-default-${crypto.randomUUID()}`;

		sharedComponent(sharedName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const sharedElement = document.createElement(sharedName);
		assertIgniteElement<State, Event>(sharedElement);
		document.body.appendChild(sharedElement);

		sharedElement.remove();

		await flushMicrotasks();
		// Default cleanup for shared (consumer-owned) sources is now false: the
		// adapter lives for the core's lifetime and must not be stopped here.
		expect(sharedAdapter.stop).not.toHaveBeenCalled();
		expect(sharedAdapter.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("allows opting out of shared lifecycle management", async () => {
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

		await flushMicrotasks();
		expect(sharedAdapter.stop).not.toHaveBeenCalled();
		expect(sharedAdapter.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("preserves isolated adapter state across same-tick DOM moves", async () => {
		let adapterCreations = 0;
		const createAdapter = vi.fn(
			() =>
				new MockAdapter<{ count: number }, Event>(
					{ count: adapterCreations++ },
					StateScope.Isolated,
				),
		);
		const moveSafeComponent = igniteElementFactory(createAdapter);
		const moveSafeName = `ignite-isolated-move-${crypto.randomUUID()}`;

		moveSafeComponent(moveSafeName, ({ state }) => (
			<div>Count: {state?.count}</div>
		));

		const moveSafeElement = document.createElement(moveSafeName);
		assertIgniteElement<{ count: number }, Event>(moveSafeElement);
		const firstParent = document.createElement("div");
		const secondParent = document.createElement("div");
		document.body.append(firstParent, secondParent);

		firstParent.appendChild(moveSafeElement);
		expect(moveSafeElement.shadowRoot?.textContent).toContain("Count: 0");

		const adapter = moveSafeElement.adapter;
		expect(adapter).toBeDefined();

		secondParent.appendChild(moveSafeElement);
		await flushMicrotasks();

		expect(createAdapter).toHaveBeenCalledTimes(1);
		expect(adapter?.stop).not.toHaveBeenCalled();
		expect(moveSafeElement.adapter).toBe(adapter);
		expect(moveSafeElement.shadowRoot?.textContent).toContain("Count: 0");

		moveSafeElement.remove();
		await flushMicrotasks();

		expect(adapter?.stop).toHaveBeenCalledTimes(1);
		firstParent.remove();
		secondParent.remove();
	});
});
