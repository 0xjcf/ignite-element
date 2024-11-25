import { html } from "lit-html";
import igniteElementFactory from "../../IgniteElmentFactory";
import createXStateAdapter from "../../adapters/XStateAdapter";
import counterMachine from "./xstateCounterMachine";

// Create the factory for XState
const xStateAdapter = createXStateAdapter(counterMachine);
const igniteElement = igniteElementFactory(xStateAdapter);

// Shared Counter Component (XState)
igniteElement.shared("my-counter-xstate", (state, send) => {
  return html`
    <div>
      <h3>Shared Counter (XState)</h3>
      <p>Count: ${state.context.count}</p>
      <button
        @click=${() => {
          send({ type: "DEC" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          send({ type: "INC" });
        }}
      >
        +
      </button>
    </div>
  `;
});

// Shared Display Component (XState)
igniteElement.shared("shared-display-xstate", (state) => {
  return html`
    <div>
      <h3>Shared State Display (XState)</h3>
      <p>Shared Count: ${state.context.count}</p>
    </div>
  `;
});

// Isolated Counter Component (XState)
igniteElement.isolated("another-counter-xstate", (state, send) => {
  return html`
    <div>
      <h3>Isolated Counter (XState)</h3>
      <p>Count: ${state.context.count}</p>
      <button
        @click=${() => {
          send({ type: "DEC" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          send({ type: "INC" });
        }}
      >
        +
      </button>
    </div>
  `;
});
