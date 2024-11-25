import { html } from "lit-html";
import { igniteElementFactory } from "./IgniteElmentFactory";
import { createReduxAdapter } from "./ReduxAdapter";
import configureCounterStore, { increment, decrement } from "./counterStore";

// Create the factory for Redux
const igniteElement = igniteElementFactory(() =>
  createReduxAdapter(configureCounterStore())
);

// Shared Component: Redux
igniteElement.shared("my-counter-redux", (state, dispatch) => {
  return html`
    <div>
      <h3>Shared Counter (Redux)</h3>
      <span>${state.count}</span>
      <button
        @click=${() => {
          console.log("Shared clicked DEC", state.count);
          dispatch(decrement());
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          console.log("Shared clicked INC", state.count);
          dispatch(increment());
        }}
      >
        +
      </button>
    </div>
  `;
});

// Isolated Component: Redux
igniteElement.isolated("another-counter-redux", (state, dispatch) => {
  return html`
    <div>
      <h3>Isolated Counter (Redux)</h3>
      <span>${state.count}</span>
      <button
        @click=${() => {
          console.log("Isolated clicked DEC", state.count);
          dispatch(decrement());
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          console.log("Isolated clicked INC", state.count);
          dispatch(increment());
        }}
      >
        +
      </button>
    </div>
  `;
});
