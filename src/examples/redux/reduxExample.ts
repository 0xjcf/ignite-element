import { html } from "lit-html";
import igniteElementFactory from "../../IgniteElmentFactory";
import createReduxAdapter from "../../adapters/ReduxAdapter";
import ReduxCounterStore, { increment, decrement } from "./reduxCounterStore";

// Create the factory for Redux
const reduxAdapter = createReduxAdapter(ReduxCounterStore);
const igniteElement = igniteElementFactory(reduxAdapter);

// Shared Component: Redux
igniteElement.shared("my-counter-redux", (state, dispatch) => {
  return html`
    <div>
      <h3>Shared Counter (Redux)</h3>
      <p>Count: ${state.count}</p>
      <button
        @click=${() => {
          dispatch(decrement());
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          dispatch(increment());
        }}
      >
        +
      </button>
    </div>
  `;
});

// Shared Display Component (XState)
igniteElement.shared("shared-display-redux", (state) => {
  return html`
    <div>
      <h3>Shared State Display (Redux)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});

// Isolated Component: Redux
igniteElement.isolated("another-counter-redux", (state, dispatch) => {
  return html`
    <div>
      <h3>Isolated Counter (Redux)</h3>
      <p>Count: ${state.count}</p>
      <button
        @click=${() => {
          dispatch(decrement());
        }}
      >
        -
      </button>
      <button
        @click=${() => {
          dispatch(increment());
        }}
      >
        +
      </button>
    </div>
  `;
});
