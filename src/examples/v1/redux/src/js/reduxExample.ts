import { html } from "lit-html";
import counterStore, {
  increment,
  decrement,
  addByAmount,
} from "./reduxCounterStore";
import { igniteCore, setGlobalStyles } from "../../../../../core";

setGlobalStyles("../scss/styles.scss");

export const { shared, isolated } = igniteCore({
  adapter: "redux",
  source: counterStore,
  actions: { increment, decrement, addByAmount },
});

// Shared Component: Redux
shared("my-counter-redux", ({ state, send }) => {
  return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-primary text-white">
        Shared Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.counter.count}</h5>
        <div class="d-flex justify-content-start">
          <button
            class="btn btn-danger me-2"
            @click=${() => send({ type: "counter/decrement" })}
          >
            -
          </button>
          <button class="btn btn-success" @click=${() => send(increment())}>
            +
          </button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component: Redux
shared("shared-display-redux", ({ state }) => {
  return html`
    <div
      class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
    >
      Shared Count: ${state.counter.count}
    </div>
  `;
});

// Isolated Component: Redux
isolated("another-counter-redux", ({ state, send }) => {
  return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-warning text-dark">
        Isolated Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.counter.count}</h5>
        <div class="d-flex justify-content-start">
          <button
            class="btn btn-secondary me-2"
            @click=${() => send(decrement())}
          >
            -
          </button>
          <button class="btn btn-primary" @click=${() => send(addByAmount(1))}>
            +
          </button>
        </div>
      </div>
    </div>
  `;
});
