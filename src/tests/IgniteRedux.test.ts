import { html } from "lit-html";
import type { Action } from "redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import counterStore, {
	addByAmount,
	increment,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import IgniteElement from "../IgniteElement";

type RootState = ReturnType<ReturnType<typeof counterStore>["getState"]>;

function assertIgniteElement<State, Event>(
	element: Element,
): asserts element is IgniteElement<State, Event> {
	expect(element).toBeInstanceOf(IgniteElement);
}

describe("igniteRedux", () => {
	afterEach(() => {
		// Ensure DOM cleanup between tests
		document.body.innerHTML = "";
	});

	describe("Shared Components", () => {
		let sharedCounter: IgniteElement<RootState, Action>;
		let sharedDisplay: IgniteElement<RootState, Action>;
		let uniqueName: string;

		beforeEach(() => {
			const sharedStore = counterStore();
			const register = igniteCore({
				adapter: "redux",
				source: () => sharedStore,
			});

			uniqueName = crypto.randomUUID();

			register(
				`shared-counter-${uniqueName}`,
				({ state, send }) => html`
				<div>Count: ${state.counter.count}</div>
				<button @click=${() => send(increment())}>+</button>
			`,
			);

			register(
				`shared-display-${uniqueName}`,
				({ state }) => html`
				<div>Count: ${state.counter.count}</div>
			`,
			);

			const counterElement = document.createElement(
				`shared-counter-${uniqueName}`,
			);
			assertIgniteElement<RootState, Action>(counterElement);
			sharedCounter = counterElement;

			const displayElement = document.createElement(
				`shared-display-${uniqueName}`,
			);
			assertIgniteElement<RootState, Action>(displayElement);
			sharedDisplay = displayElement;

			document.body.append(sharedCounter, sharedDisplay);
		});

		it("synchronizes state updates across shared components", () => {
			const button = sharedCounter.shadowRoot?.querySelector("button");
			button?.click();

			const count1 =
				sharedCounter.shadowRoot?.querySelector("div")?.textContent;
			const count2 =
				sharedDisplay.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 1");
			expect(count2).toBe("Count: 1");
		});
	});

	describe("Isolated Components", () => {
		let isolatedCounter: IgniteElement<RootState, Action>;
		let isolatedDisplay: IgniteElement<RootState, Action>;
		let uniqueName: string;

		beforeEach(() => {
			const register = igniteCore({
				adapter: "redux",
				source: counterStore,
			});

			uniqueName = crypto.randomUUID();

			register(
				`isolated-counter-${uniqueName}`,
				({ state, send }) => html`
				<div>Count: ${state.counter.count}</div>
				<button @click=${() => send(increment())}>+</button>
			`,
			);

			register(
				`isolated-display-${uniqueName}`,
				({ state }) => html`
				<div>Count: ${state.counter.count}</div>
			`,
			);

			const counterElement = document.createElement(
				`isolated-counter-${uniqueName}`,
			);
			assertIgniteElement<RootState, Action>(counterElement);
			isolatedCounter = counterElement;
			const displayElement = document.createElement(
				`isolated-display-${uniqueName}`,
			);
			assertIgniteElement<RootState, Action>(displayElement);
			isolatedDisplay = displayElement;

			document.body.append(isolatedCounter, isolatedDisplay);
		});

		it("maintains independent state between isolated components", () => {
			const button = isolatedCounter.shadowRoot?.querySelector("button");
			button?.click();

			const count1 =
				isolatedCounter.shadowRoot?.querySelector("div")?.textContent;
			const count2 =
				isolatedDisplay.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 1");
			expect(count2).toBe("Count: 0");
		});

		it("handles independent state updates", () => {
			isolatedCounter.dispatchEvent(
				new CustomEvent("send", { detail: addByAmount(3) }),
			);
			isolatedDisplay.dispatchEvent(
				new CustomEvent("send", { detail: addByAmount(5) }),
			);

			const count1 =
				isolatedCounter.shadowRoot?.querySelector("div")?.textContent;
			const count2 =
				isolatedDisplay.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 3");
			expect(count2).toBe("Count: 5");
		});
	});
});
