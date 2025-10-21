import { html } from "lit-html";
import { setGlobalStyles } from "../../../../globalStyles";
import { igniteCore } from "../../../../IgniteCore";
import counterStore, {
	addByAmount,
	counterSlice,
	decrement,
	increment,
} from "./reduxCounterStore";

const stylesHref = new URL("../scss/styles.scss", import.meta.url).href;
setGlobalStyles(stylesHref);

const sharedStore = counterStore();

export const registerSharedRedux = igniteCore({
	adapter: "redux",
	source: () => sharedStore,
});

export const registerIsolatedRedux = igniteCore({
	adapter: "redux",
	source: counterSlice,
});

// Shared Component: Redux
registerSharedRedux("my-counter-redux", ({ state, send }) => {
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
registerSharedRedux("shared-display-redux", ({ state }) => {
	return html`
    <div
      class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
    >
      Shared Count: ${state.counter.count}
    </div>
  `;
});

// Isolated Component: Redux
registerIsolatedRedux("another-counter-redux", ({ state, send }) => {
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
