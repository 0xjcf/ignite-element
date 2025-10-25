/** @jsxImportSource ../../../../renderers/jsx */

import { igniteCore } from "../../../../IgniteCore";
import counterStore, { counterSlice } from "./reduxCounterStore";

const sharedStore = counterStore();

export const registerSharedRedux = igniteCore({
	source: sharedStore,
	states: (snapshot) => ({
		count: snapshot.counter.count,
	}),
	commands: (store) => ({
		decrement: () => store.dispatch(counterSlice.actions.decrement()),
		increment: () => store.dispatch(counterSlice.actions.increment()),
		addByAmount: (value: number) =>
			store.dispatch(counterSlice.actions.addByAmount(value)),
	}),
});

export const registerIsolatedRedux = igniteCore({
	source: counterSlice,
	states: (snapshot) => ({
		count: snapshot.counter.count,
	}),
	commands: (store) => ({
		decrement: () => store.dispatch(counterSlice.actions.decrement()),
		increment: () => store.dispatch(counterSlice.actions.increment()),
		addByAmount: (value: number) =>
			store.dispatch(counterSlice.actions.addByAmount(value)),
	}),
});

registerSharedRedux(
	"my-counter-redux",
	({ count, send, increment, addByAmount }) => (
		<div class="card text-start shadow-sm mb-3" data-bs-theme="light">
			<div class="card-header bg-primary text-white">
				Shared Counter (Redux)
			</div>
			<div class="card-body bg-dark text-white">
				<h5 class="card-title">Count: {count}</h5>
				<div class="d-flex justify-content-start">
					<button
						type="button"
						class="btn btn-danger me-2"
						onClick={() => send({ type: "counter/decrement" })}
					>
						-
					</button>
					<button
						type="button"
						class="btn btn-success me-2"
						onClick={() => increment()}
					>
						+1
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onClick={() => addByAmount(5)}
					>
						+5
					</button>
				</div>
			</div>
		</div>
	),
);

registerSharedRedux("shared-display-redux", ({ count }) => (
	<div
		data-bs-theme="light"
		class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
	>
		Shared Count: {count}
	</div>
));

registerIsolatedRedux(
	"another-counter-redux",
	({ count, send, addByAmount }) => (
		<div class="card text-start shadow-sm mb-3" data-bs-theme="light">
			<div class="card-header bg-warning text-dark">
				Isolated Counter (Redux)
			</div>
			<div class="card-body bg-dark text-white">
				<h5 class="card-title">Count: {count}</h5>
				<div class="d-flex justify-content-start">
					<button
						type="button"
						class="btn btn-secondary me-2"
						onClick={() => send({ type: "counter/decrement" })}
					>
						-
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onClick={() => addByAmount(1)}
					>
						+
					</button>
				</div>
			</div>
		</div>
	),
);
