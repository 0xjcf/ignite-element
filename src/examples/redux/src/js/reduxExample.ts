import { html } from "lit-html";
import counterStore, { increment, decrement } from "./reduxCounterStore";
import { igniteCore } from "../../../../IgniteCore";

const igniteElement = igniteCore({
  adapter: "redux",
  source: counterStore,
  styles: {
    paths: ["../scss/styles.scss"],
  },
});

// Shared Component: Redux
igniteElement.shared("my-counter-redux", (state, dispatch) => {
  return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-primary text-white">
        Shared Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.count}</h5>
        <div class="d-flex justify-content-start">
          <button
            class="btn btn-danger me-2"
            @click=${() => dispatch(decrement())}
          >
            -
          </button>
          <button class="btn btn-success" @click=${() => dispatch(increment())}>
            +
          </button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component: Redux
igniteElement.shared("shared-display-redux", (state) => {
  return html`
    <div
      class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
    >
      Shared Count: ${state.count}
    </div>
  `;
});

// Isolated Component: Redux
igniteElement.isolated("another-counter-redux", (state, dispatch) => {
  return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-warning text-dark">
        Isolated Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.count}</h5>
        <div class="d-flex justify-content-start">
          <button
            class="btn btn-secondary me-2"
            @click=${() => dispatch(decrement())}
          >
            -
          </button>
          <button class="btn btn-primary" @click=${() => dispatch(increment())}>
            +
          </button>
        </div>
      </div>
    </div>
  `;
});
