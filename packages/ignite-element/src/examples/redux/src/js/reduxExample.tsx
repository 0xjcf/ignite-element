/** @jsxImportSource ignite-element/jsx */

// Ignite renders into Shadow DOM, so Bootstrap's classes (card, btn, …) can't
// reach component internals from a global link. Pull the stylesheet in as raw
// text and inject a <style> into each component's shadow root — the config-free
// path (no ignite.config.ts, no sass build step).
import bootstrapStyles from "bootstrap/dist/css/bootstrap.min.css?raw";
import { igniteCore } from "ignite-element/redux";
import counterStore, { counterSlice } from "./reduxCounterStore";

type CounterStoreInstance = ReturnType<typeof counterStore>;
type CounterSnapshot = ReturnType<CounterStoreInstance["getState"]>;
type CounterSliceSnapshot = ReturnType<typeof counterSlice.reducer>;

const resolveReduxView = (snapshot: CounterSnapshot) => ({
	count: snapshot.counter.count,
});

const resolveReduxSliceView = (snapshot: CounterSliceSnapshot) => ({
	count: snapshot.count,
});

const sharedStore = counterStore();

export const registerSharedRedux = igniteCore({
	source: sharedStore,
	view: ({ snapshot }) => resolveReduxView(snapshot),
	commands: ({ actor }) => ({
		decrement: () => actor.dispatch(counterSlice.actions.decrement()),
		increment: () => actor.dispatch(counterSlice.actions.increment()),
		addByAmount: (value: number) =>
			actor.dispatch(counterSlice.actions.addByAmount(value)),
	}),
});

export const registerIsolatedRedux = igniteCore({
	source: counterSlice,
	view: ({ snapshot }) => resolveReduxSliceView(snapshot),
	commands: ({ actor }) => ({
		decrement: () => actor.dispatch(counterSlice.actions.decrement()),
		increment: () => actor.dispatch(counterSlice.actions.increment()),
		addByAmount: (value: number) =>
			actor.dispatch(counterSlice.actions.addByAmount(value)),
	}),
});

registerSharedRedux("my-counter-redux", (ctx) => (
	<div class="card text-start shadow-sm mb-3" data-bs-theme="light">
		<style>{bootstrapStyles}</style>
		<div class="card-header bg-primary text-white">Shared Counter (Redux)</div>
		<div class="card-body bg-dark text-white">
			<h5 class="card-title">Count: {ctx.count}</h5>
			<div class="d-flex justify-content-start">
				<button
					type="button"
					class="btn btn-danger me-2"
					onClick={() => ctx.decrement()}
				>
					-1
				</button>
				<button
					type="button"
					class="btn btn-success me-2"
					onClick={() => ctx.increment()}
				>
					+1
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onClick={() => ctx.addByAmount(5)}
				>
					+5
				</button>
			</div>
		</div>
	</div>
));

registerSharedRedux("shared-display-redux", (ctx) => (
	<div
		data-bs-theme="light"
		class="p-3 text-start text-success-emphasis bg-success-subtle border border-success-subtle rounded-3 mb-4"
	>
		<style>{bootstrapStyles}</style>
		Shared Count: {ctx.count}
	</div>
));

registerIsolatedRedux("another-counter-redux", (ctx) => (
	<div class="card text-start shadow-sm mb-3" data-bs-theme="light">
		<style>{bootstrapStyles}</style>
		<div class="card-header bg-warning text-dark">Isolated Counter (Redux)</div>
		<div class="card-body bg-dark text-white">
			<h5 class="card-title">Count: {ctx.count}</h5>
			<div class="d-flex justify-content-start">
				<button
					type="button"
					class="btn btn-secondary me-2"
					onClick={() => ctx.decrement()}
				>
					-1
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onClick={() => ctx.addByAmount(1)}
				>
					+1
				</button>
			</div>
		</div>
	</div>
));
