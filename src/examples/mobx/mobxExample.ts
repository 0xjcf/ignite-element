import { html } from "lit-html";
import counterStore from "./mobxCounterStore";
import { igniteCore } from "../../IgniteCore";

// Initialize igniteElement with MobX adapter
const igniteElement = igniteCore({
  adapter: "mobx",
  source: counterStore,
});

// Shared Counter Component
igniteElement.shared("my-counter-mobx", (state, send) => {
  return html`
    <div>
      <h3>Shared Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button
        @click=${() => {
          send({ type: "decrement" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          send({ type: "increment" });
        }}
      >
        +
      </button>
    </div>
  `;
});

// Shared Display Component
igniteElement.shared("shared-display-mobx", (state) => {
  return html`
    <div>
      <h3>Shared State Display (Mobx)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});

// Isolated Counter Component
igniteElement.isolated("another-counter-mobx", (state, action) => {
  return html`
    <div>
      <h3>Isolated Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button
        @click=${() => {
          action({ type: "decrement" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          action({ type: "increment" });
        }}
      >
        +
      </button>
    </div>
  `;
});
