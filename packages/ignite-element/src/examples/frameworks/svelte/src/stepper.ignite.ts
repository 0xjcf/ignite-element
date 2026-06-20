import "@ignite-element/renderer/lit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import { igniteCore } from "ignite-element/redux";
import { html } from "lit-html";

// A small, framework-neutral ignite element backed by a Redux Toolkit slice —
// a DIFFERENT adapter than the React (xstate) and Vue (xstate) demos, on
// purpose, to exercise Redux across the framework-interop set. Its view is
// authored with lit-html: config-free in v3 (importing
// `@ignite-element/renderer/lit` registers the lit strategy and Ignite
// auto-detects the returned `TemplateResult`). The Svelte host consumes this
// element through the standard custom-element surface and never sees the adapter
// or the renderer behind it.
const stepperSlice = createSlice({
	name: "stepper",
	initialState: { value: 0, step: 1, label: "Quantity" },
	reducers: {
		increment: (state) => {
			state.value += state.step;
		},
		decrement: (state) => {
			state.value -= state.step;
		},
		reset: (state) => {
			state.value = 0;
		},
		setLabel: (state, action: PayloadAction<string>) => {
			state.label = action.payload;
		},
		setStep: (state, action: PayloadAction<number>) => {
			state.step = action.payload;
		},
	},
});

const stepper = igniteCore({
	// An isolated slice source: each element instance gets its own store.
	source: stepperSlice,
	view: ({ snapshot }) => ({
		value: snapshot.value,
		step: snapshot.step,
		label: snapshot.label,
	}),
	commands: ({ actor }) => ({
		increment: () => actor.dispatch(stepperSlice.actions.increment()),
		decrement: () => actor.dispatch(stepperSlice.actions.decrement()),
		reset: () => actor.dispatch(stepperSlice.actions.reset()),
		// Single-arg `setX` commands are exposed as observed attributes
		// (`setLabel` -> `label`, `setStep` -> `step`). The attribute bridge is
		// stringly-typed — the DOM hands every attribute value over as a string —
		// so a numeric setter must coerce. `label` needs none; `setStep` wraps its
		// argument in `Number()` so both the attribute path (`"5"`) and a direct
		// imperative call (`setStep(5)`) land as a number.
		setLabel: (label: string) =>
			actor.dispatch(stepperSlice.actions.setLabel(label)),
		setStep: (step: number) =>
			actor.dispatch(stepperSlice.actions.setStep(Number(step))),
	}),
	events: (event) => ({
		// Emitted outward as a CustomEvent; the Svelte host listens for `changed`.
		changed: event<{ value: number }>(),
	}),
	effects: ({ snapshot, emit, select }) => {
		const value = select((current) => current.value);
		if (!value.changed) return;
		emit("changed", { value: snapshot.value });
	},
});

// The framework-neutral handle (a standard custom element). The lit-html view is
// auto-detected and rendered with lit. The element is a pure display — the host
// drives it through commands — so the Svelte demo shows the host controlling the
// element, not the element controlling itself. The accent is Svelte orange
// (#ff3e00) to distinguish it from the React and Vue demos.
export const igniteStepper = stepper(
	"ignite-stepper",
	({ value, step, label }) => html`
		<style>
			.stepper {
				display: inline-flex;
				flex-direction: column;
				gap: 0.4rem;
				align-items: flex-start;
				font: 600 1rem system-ui, sans-serif;
				padding: 1rem 1.4rem;
				border-radius: 0.9rem;
				border: 1px solid #334155;
				border-left: 4px solid #ff3e00;
				background: linear-gradient(135deg, #1e293b, #111c33);
				color: #cbd5e1;
				min-width: 11rem;
			}
			.stepper-label {
				font-size: 0.8rem;
				font-weight: 700;
				letter-spacing: 0.04em;
				text-transform: uppercase;
				color: #94a3b8;
			}
			.stepper-value {
				font: 800 2.6rem/1 system-ui, sans-serif;
				color: #ff3e00;
				font-variant-numeric: tabular-nums;
			}
			.stepper-step {
				font: 600 0.72rem system-ui, sans-serif;
				letter-spacing: 0.05em;
				padding: 0.15rem 0.55rem;
				border-radius: 999px;
				background: rgba(255, 62, 0, 0.14);
				color: #ff7a4d;
			}
		</style>
		<div class="stepper">
			<span class="stepper-label">${label}</span>
			<output class="stepper-value">${value}</output>
			<span class="stepper-step">step ${step}</span>
		</div>
	`,
);
