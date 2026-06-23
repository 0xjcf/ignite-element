<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// The ignite element exposes its commands as plain element methods — there is no
// typed handle without a wrapper (the same imperative seam React's `igniteReact`
// smooths over). From Vue we reach a command through a template ref + a small
// cast; that cast is the honest cost of consuming a raw custom element.
type IgniteToggleElement = HTMLElement & { toggle?: () => void };

const toggleRef = ref<IgniteToggleElement | null>(null);

// `label` flows IN as a string attribute (single-arg `setLabel` -> `label`).
const label = ref("Notifications");

// `isOn` is Vue's mirror of the element's outward `toggled` event — the view
// stays declarative; the element owns the truth.
const isOn = ref(false);

const onToggled = (event: Event) => {
	isOn.value = (event as CustomEvent<{ isOn: boolean }>).detail.isOn;
};

// Custom-element events are DOM CustomEvents. `addEventListener` is the
// always-correct path (and what the integration guide shows). Vue's `@toggled`
// also works for an all-lowercase event name; a camelCase event (e.g.
// `countChanged`) would need `@count-changed` or this explicit listener — the
// event-casing caveat worth knowing.
onMounted(() => {
	toggleRef.value?.addEventListener("toggled", onToggled);
});
onBeforeUnmount(() => {
	toggleRef.value?.removeEventListener("toggled", onToggled);
});

const toggleFromVue = () => toggleRef.value?.toggle?.();
</script>

<template>
	<main class="app">
		<h1>ignite-element + Vue</h1>
		<p class="lede">
			Vue consumes the same ignite custom element through the standard browser
			surface: attributes in, a template ref for commands, and DOM
			<code>CustomEvent</code>s out. The one setup cost is
			<code>compilerOptions.isCustomElement</code> in the Vite config.
		</p>

		<ignite-toggle ref="toggleRef" :label="label" />

		<p class="mirror">
			Vue's mirror of the element's state:
			<strong>{{ isOn ? "On" : "Off" }}</strong>
		</p>

		<div class="controls">
			<button type="button" @click="toggleFromVue">Toggle from Vue</button>
		</div>

		<label class="label-field">
			Element label
			<input v-model="label" placeholder="Set the element label" />
		</label>
	</main>
</template>

<style scoped>
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
	color: #34d399;
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
</style>
