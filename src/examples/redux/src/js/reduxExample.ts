import { html } from "lit-html";
import { igniteCore } from "../../../../IgniteCore";
import type {
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "../../../../RenderArgs";
import type { InferStateAndEvent } from "../../../../utils/igniteRedux";
import counterStore, { counterSlice } from "./reduxCounterStore";

import "../../ignite.config";

const sharedStore = counterStore();

type SharedStoreInstance = ReturnType<typeof counterStore>;
type SharedStoreState = InferStateAndEvent<SharedStoreInstance>["State"];
type SharedStoreActor = ReduxStoreCommandActor<SharedStoreInstance>;
type AddByAmountValue = Parameters<typeof counterSlice.actions.addByAmount>[0];

const sharedStates = (snapshot: SharedStoreState) => ({
	count: snapshot.counter.count,
});

const sharedCommandHandlers = (actor: SharedStoreActor) => ({
	decrement: () => actor.dispatch(counterSlice.actions.decrement()),
	increment: () => actor.dispatch(counterSlice.actions.increment()),
	addByAmount: (value: AddByAmountValue) =>
		actor.dispatch(counterSlice.actions.addByAmount(value)),
});

export const registerSharedRedux = igniteCore({
	source: sharedStore, // shared store instance reused across components
	states: sharedStates,
	commands: sharedCommandHandlers,
});

type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
type SliceActor = ReduxSliceCommandActor<typeof counterSlice>;

const isolatedStates = (snapshot: SliceState) => ({
	count: snapshot.counter.count,
});

const isolatedCommandHandlers = (actor: SliceActor) => ({
	decrement: () => actor.dispatch(counterSlice.actions.decrement()),
	increment: () => actor.dispatch(counterSlice.actions.increment()),
	addByAmount: (value: AddByAmountValue) =>
		actor.dispatch(counterSlice.actions.addByAmount(value)),
});

export const registerIsolatedRedux = igniteCore({
	source: counterSlice,
	states: isolatedStates,
	commands: isolatedCommandHandlers,
});

// Shared Component: Redux
registerSharedRedux(
	"my-counter-redux",
	({ count, send, increment, addByAmount }) => {
		return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-primary text-white">
        Shared Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${count}</h5>
		<div class="d-flex justify-content-start">
		  <button
			class="btn btn-danger me-2"
			@click=${() => send({ type: "counter/decrement" })}
		  >
            -
          </button>
          <button class="btn btn-success me-2" @click=${() => increment()}>
            +1
          </button>
          <button class="btn btn-primary" @click=${() => addByAmount(5)}>
            +5
          </button>
        </div>
      </div>
    </div>
  `;
	},
);

// Shared Display Component: Redux
registerSharedRedux("shared-display-redux", ({ count }) => {
	return html`
    <div
      class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
    >
      Shared Count: ${count}
    </div>
  `;
});

// Isolated Component: Redux
registerIsolatedRedux(
	"another-counter-redux",
	({ count, send, addByAmount }) => {
		return html`
    <div class="card text-start shadow-sm mb-3" data-bs-theme="dark">
      <div class="card-header bg-warning text-dark">
        Isolated Counter (Redux)
      </div>
      <div class="card-body">
        <h5 class="card-title">Count: ${count}</h5>
		<div class="d-flex justify-content-start">
		  <button
			class="btn btn-secondary me-2"
			@click=${() => send({ type: "counter/decrement" })}
		  >
            -
          </button>
          <button class="btn btn-primary" @click=${() => addByAmount(1)}>
            +
          </button>
        </div>
      </div>
    </div>
  `;
	},
);
