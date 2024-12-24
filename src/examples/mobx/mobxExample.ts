import { html } from "lit-html";
import { igniteCore } from "../../IgniteCore";
import { setGlobalStyles } from "../../globalStyles";
import counterStore from "./mobxCounterStore";

// Set global styles for shared theme
setGlobalStyles("./theme.css");

// Initialize igniteCore with MobX adapter
export const { isolated, shared } = igniteCore({
  adapter: "mobx",
  source: counterStore,
});

// Shared Counter Component
shared("my-counter-mobx", ({ state, send }) => {
  return html`
    <div>
      <div class="container">
        <h3>Shared Counter (MobX)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => send({ type: "decrement" })}>-</button>
          <button @click=${() => send({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component
shared("shared-display-mobx", ({ state }) => {
  return html`
    <div class="display">
      <h3>Shared State Display (MobX)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});

// Isolated Counter Component with Custom Styles
isolated("another-counter-mobx", ({ state, send }) => {
  return html`
    <div>
      <link rel="stylesheet" href="./another-counter-mobx.css" />
      <div class="container">
        <h3>Isolated Counter (Custom Styled)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => send({ type: "decrement" })}>-</button>
          <button @click=${() => send({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});
