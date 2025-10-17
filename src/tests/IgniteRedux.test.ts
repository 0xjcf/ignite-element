import { html } from "lit-html";
import type { Action } from "redux";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import counterStore, {
	addByAmount,
	decrement,
	increment,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type IgniteElement from "../IgniteElement";

type RootState = ReturnType<ReturnType<typeof counterStore>["getState"]>;

describe("igniteRedux", () => {
	// Initialize igniteCore for Redux
	const igniteElement = igniteCore({
		adapter: "redux",
		source: counterStore,
		actions: { increment, decrement },
	});

	// Shared Components Tests
	describe("Shared Components", () => {
		let shared1: IgniteElement<RootState, Action>;
		let shared2: IgniteElement<RootState, Action>;
		let uniqueName: string;

		beforeEach(() => {
			uniqueName = crypto.randomUUID(); // Unique names for each run

			// Register Shared Components
			igniteElement.shared(
				`shared-counter-${uniqueName}`,
				({ state, send }) => {
					return html`
            <div>Count: ${state.counter.count}</div>
            <button @click=${() => send(increment())}>+</button>
          `;
				},
			);

			igniteElement.shared(`shared-display-${uniqueName}`, ({ state }) => {
				return html`<div>Count: ${state.counter.count}</div>`;
			});

			// Create and append elements
			shared1 = document.createElement(
				`shared-counter-${uniqueName}`,
			) as IgniteElement<RootState, Action>;
			shared2 = document.createElement(
				`shared-display-${uniqueName}`,
			) as IgniteElement<RootState, Action>;
			document.body.appendChild(shared1);
			document.body.appendChild(shared2);
		});

		afterAll(() => {
			// Remove elements explicitly
			if (shared1?.isConnected) {
				document.body.removeChild(shared1);
			}
			if (shared2?.isConnected) {
				document.body.removeChild(shared2);
			}
		});

		it("should synchronize state updates across shared components", () => {
			const button = shared1.shadowRoot?.querySelector("button");
			button?.click(); // Increment shared state

			const count1 = shared1.shadowRoot?.querySelector("div")?.textContent;
			const count2 = shared2.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 1");
			expect(count2).toBe("Count: 1"); // Both should update together
		});
	});

	// Isolated Components Tests
	describe("Isolated Components", () => {
		let isolated1: HTMLElement;
		let isolated2: HTMLElement;
		let uniqueName: string;

		beforeEach(() => {
			uniqueName = crypto.randomUUID(); // Unique names for each run

			// Register Isolated Components
			igniteElement.isolated(
				`isolated-counter-${uniqueName}`,
				({ state, send }) => {
					return html`
            <div>Count: ${state.counter.count}</div>
            <button @click=${() => send(increment())}>+</button>
          `;
				},
			);

			igniteElement.isolated(`isolated-display-${uniqueName}`, ({ state }) => {
				return html`<div>Count: ${state.counter.count}</div>`;
			});

			// Create and append elements
			isolated1 = document.createElement(`isolated-counter-${uniqueName}`);
			isolated2 = document.createElement(`isolated-display-${uniqueName}`);
			document.body.appendChild(isolated1);
			document.body.appendChild(isolated2);
		});

		afterAll(() => {
			// Remove elements explicitly
			if (isolated1?.isConnected) {
				document.body.removeChild(isolated1);
			}
			if (isolated2?.isConnected) {
				document.body.removeChild(isolated2);
			}
		});

		it("should maintain independent state between isolated components", () => {
			const button = isolated1.shadowRoot?.querySelector("button");
			button?.click(); // Increment isolated1 state

			const count1 = isolated1.shadowRoot?.querySelector("div")?.textContent;
			const count2 = isolated2.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 1");
			expect(count2).toBe("Count: 0"); // Should not affect other isolated components
		});

		it("should handle independent state updates", () => {
			// Use valid actions to dispatch updates
			isolated1.dispatchEvent(
				new CustomEvent("send", {
					detail: addByAmount(3),
				}),
			);

			isolated2.dispatchEvent(
				new CustomEvent("send", {
					detail: addByAmount(5),
				}),
			);

			const count1 = isolated1.shadowRoot?.querySelector("div")?.textContent;
			const count2 = isolated2.shadowRoot?.querySelector("div")?.textContent;

			expect(count1).toBe("Count: 3");
			expect(count2).toBe("Count: 5"); // Different states
		});
	});
});
