import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { html } from "lit-html";
import counterStore, {
  addByAmount,
  decrement,
  increment,
} from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";

describe("igniteRedux", () => {
  // Initialize igniteCore for Redux
  const igniteElement = igniteCore({
    adapter: "redux",
    source: counterStore,
    actions: { increment, decrement },
  });
  // Shared Components Tests
  describe("Shared Components", () => {
    let shared1: HTMLElement;
    let shared2: HTMLElement;
    beforeEach(() => {
      const uniqueName = crypto.randomUUID(); // Unique names for each run

      // Shared Components
      shared1 = igniteElement.shared(
        `shared-counter-${uniqueName}`,
        ({ state, send }) => {
          return html`
            <div>Count: ${state.counter.count}</div>
            <button @click=${() => send(increment())}>+</button>
          `;
        }
      );
      shared2 = igniteElement.shared(
        `shared-display-${uniqueName}`,
        ({ state }) => {
          return html`<div>Count: ${state.counter.count}</div>`;
        }
      );

      document.body.appendChild(shared1);
      document.body.appendChild(shared2);
    });

    afterAll(() => {
      // Remove elements explicitly
      if (shared1.isConnected) {
        document.body.removeChild(shared1);
      }
      if (shared2.isConnected) {
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
    beforeEach(() => {
      const uniqueName = crypto.randomUUID(); // Unique names for each run

      // Isolated Components
      isolated1 = igniteElement.isolated(
        `isolated-counter-${uniqueName}`,
        ({ state, send }) => {
          return html`
            <div>Count: ${state.counter.count}</div>
            <button @click=${() => send(increment())}>+</button>
          `;
        }
      );
      isolated2 = igniteElement.isolated(
        `isolated-display-${uniqueName}`,
        ({ state }) => {
          return html`<div>Count: ${state.counter.count}</div>`;
        }
      );

      document.body.appendChild(isolated1);
      document.body.appendChild(isolated2);
    });

    afterAll(() => {
      // Remove elements explicitly
      if (isolated1.isConnected) {
        document.body.removeChild(isolated1);
      }
      if (isolated2.isConnected) {
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
        })
      );

      isolated2.dispatchEvent(
        new CustomEvent("send", {
          detail: addByAmount(5),
        })
      );

      const count1 = isolated1.shadowRoot?.querySelector("div")?.textContent;
      const count2 = isolated2.shadowRoot?.querySelector("div")?.textContent;

      expect(count1).toBe("Count: 3");
      expect(count2).toBe("Count: 5"); // Different states
    });
  });
});
