import { html } from "lit-html";
import counterStore from "./mobxCounterStore";
import { igniteCore } from "../../IgniteCore";

// Initialize igniteElement with MobX adapter
const igniteElement = igniteCore({
  adapter: "mobx",
  source: counterStore,
  styles: {
    custom: `
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin: 10px;
        padding: 10px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 5px;
        background-color: var(--background-color, #f9f9f9);
      }

      h3 {
        color: var(--header-color, #000);
      }

      button {
        margin: 5px;
        padding: 5px 10px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        background-color: var(--button-color, #007bff);
        color: var(--button-text-color, white);
      }

      button:hover {
        background-color: var(--button-hover-color, #0056b3);
      }
    `,
  },
});

// Shared Counter Component
igniteElement.shared("my-counter-mobx", (state, send) => {
  return html`
    <style>
      :host {
        --background-color: #f9f9f9;
        --header-color: #007bff;
        --button-color: #ff6b6b;
        --button-hover-color: #d9534f;
      }
    </style>
    <div>
      <h3>Shared Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button @click=${() => send({ type: "decrement" })}>-</button>
      <button @click=${() => send({ type: "increment" })}>+</button>
    </div>
  `;
});

// Shared Display Component
igniteElement.shared("shared-display-mobx", (state) => {
  return html`
    <style>
      :host {
        --background-color: #e9ecef;
        --header-color: #17a2b8;
      }
    </style>
    <div>
      <h3>Shared State Display (Mobx)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});

// Isolated Counter Component
igniteElement.isolated("another-counter-mobx", (state, action) => {
  return html`
    <style>
      :host {
        --background-color: #fff3cd;
        --header-color: #856404;
        --button-color: #ffc107;
        --button-hover-color: #ffca28;
      }
    </style>
    <div>
      <h3>Isolated Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button @click=${() => action({ type: "decrement" })}>-</button>
      <button @click=${() => action({ type: "increment" })}>+</button>
    </div>
  `;
});
