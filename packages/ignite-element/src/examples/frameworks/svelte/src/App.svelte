<script lang="ts">
// The ignite element exposes its commands as plain element methods — there is
// no typed handle without a wrapper (the same imperative seam React's
// `igniteReact` smooths over). From Svelte we reach a command through
// `bind:this` + a small cast; that cast is the honest cost of consuming a raw
// custom element.
type IgniteStepperElement = HTMLElement & {
	increment?: () => void;
	decrement?: () => void;
	reset?: () => void;
};

let stepperEl: IgniteStepperElement;

// `label` flows IN as a string attribute (single-arg `setLabel` -> `label`).
let label = "Cart items";

// `step` flows IN too. The host treats it as a number; it reaches the element
// as a string attribute (`setStep` -> `step`) and the element coerces — the
// honest string-attribute friction. Svelte sets it cleanly with `step={step}`;
// no DOM-property gymnastics needed.
let step = 1;

// `value` is Svelte's mirror of the element's outward `changed` event — the
// view stays declarative; the element owns the truth.
let value = 0;

// Custom-element events are DOM CustomEvents. Svelte's `on:changed` attaches a
// listener for exactly that event — case-preserving, declarative, and needing
// no manual `addEventListener` (the path React before 19 and Vue both fall
// back to). The detail carries the flat payload.
const onChanged = (event: Event) => {
	value = (event as CustomEvent<{ value: number }>).detail.value;
};
</script>

<main class="app">
	<h1>ignite-element + Svelte</h1>
	<p class="lede">
		Svelte consumes the same kind of ignite custom element through the standard
		browser surface — and needs <em>zero</em> compiler config to do it (no Vue
		<code>isCustomElement</code>, no Angular schema). Attributes in,
		<code>bind:this</code> for commands, and <code>on:changed</code> for DOM
		<code>CustomEvent</code>s out.
	</p>

	<ignite-stepper bind:this={stepperEl} {label} step={step} on:changed={onChanged}></ignite-stepper>

	<p class="mirror">
		Svelte's mirror of the element's value: <strong>{value}</strong>
	</p>

	<div class="controls">
		<button type="button" on:click={() => stepperEl?.decrement?.()}>−{step}</button>
		<button type="button" on:click={() => stepperEl?.increment?.()}>+{step}</button>
		<button type="button" class="ghost" on:click={() => stepperEl?.reset?.()}>Reset</button>
	</div>

	<label class="label-field">
		Element label
		<input bind:value={label} placeholder="Set the element label" />
	</label>

	<fieldset class="step-field">
		<legend>Step (flows in as an attribute)</legend>
		{#each [1, 5, 10] as option (option)}
			<button
				type="button"
				class="chip"
				class:active={step === option}
				on:click={() => (step = option)}
			>
				{option}
			</button>
		{/each}
	</fieldset>
</main>

<style>
	.app {
		font: 1rem/1.6 system-ui, sans-serif;
		width: min(30rem, 90vw);
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 2rem;
	}
	.app h1 {
		margin: 0;
		font-size: 1.5rem;
	}
	.lede {
		color: #94a3b8;
		font-size: 0.9rem;
		line-height: 1.6;
	}
	.lede code {
		color: #cbd5e1;
		background: #1e293b;
		padding: 0.05em 0.35em;
		border-radius: 0.3rem;
	}
	.mirror {
		color: #94a3b8;
		font-size: 0.9rem;
	}
	.mirror strong {
		color: #ff3e00;
	}
	.controls {
		display: flex;
		gap: 0.6rem;
	}
	.controls button {
		font: inherit;
		padding: 0.55rem 1.1rem;
		border-radius: 0.5rem;
		border: 1px solid #334155;
		background: #334155;
		color: inherit;
		cursor: pointer;
	}
	.controls button:hover {
		background: #3f4d63;
	}
	.controls .ghost {
		background: transparent;
	}
	.label-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: #94a3b8;
	}
	.label-field input {
		font: inherit;
		padding: 0.5rem 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
	}
	.step-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0.75rem 0.9rem;
		border: 1px solid #334155;
		border-radius: 0.5rem;
	}
	.step-field legend {
		padding: 0 0.4rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.chip {
		font: inherit;
		min-width: 2.4rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid #334155;
		background: #0f172a;
		color: #cbd5e1;
		cursor: pointer;
	}
	.chip.active {
		border-color: #ff3e00;
		color: #ff3e00;
	}
</style>
