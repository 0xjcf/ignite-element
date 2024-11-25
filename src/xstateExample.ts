import { html } from "lit-html";
import { igniteElementFactory } from "./IgniteElmentFactory";
import { createXStateAdapter } from "./XStateAdapter";
import counterMachine from "./counterMachine";

// Create the factory for XState
const igniteElement = igniteElementFactory(() =>
  createXStateAdapter(counterMachine)
);

// Shared Counter Component (XState)
igniteElement.shared("my-counter-xstate", (state, send) => {
  return html`
    <div>
      <h3>Shared Counter (XState)</h3>
      <span>${state.context.count}</span>
      <button
        @click=${() => {
          console.log("Shared clicked DEC", state.context.count);
          send({ type: "DEC" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          console.log("Shared clicked INC", state.context.count);
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
      <span>Shared Count: ${state.context.count}</span>
    </div>
  `;
});

// Isolated Counter Component (XState)
igniteElement.isolated("another-counter-xstate", (state, send) => {
  return html`
    <div>
      <h3>Isolated Counter (XState)</h3>
      <span>${state.context.count}</span>
      <button
        @click=${() => {
          console.log("Isolated clicked DEC", state.context.count);
          send({ type: "DEC" });
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          console.log("Isolated clicked INC", state.context.count);
          send({ type: "INC" });
        }}
      >
        +
      </button>
    </div>
  `;
});
