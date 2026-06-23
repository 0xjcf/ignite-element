import "@ignite-element/renderer/lit";
import { igniteCore } from "ignite-element/xstate";
import { html } from "lit-html";
import { assign, setup } from "xstate";

// A small, framework-neutral ignite element. Its view is authored with lit-html
// — config-free in v3: importing `@ignite-element/renderer/lit` registers the
// lit strategy, and Ignite auto-detects the returned `TemplateResult` and renders
// it with lit (no `ignite.config.ts`, no bundler plugin). The Vue host consumes
// this element through the standard custom-element surface and never sees how the
// view is authored — a different renderer than the React example (ignite-jsx) on
// purpose, to exercise both across the framework demos.
const toggleMachine = setup({
	types: {} as {
		context: { on: boolean; label: string };
		events: { type: "TOGGLE" } | { type: "SET_LABEL"; label: string };
	},
}).createMachine({
	id: "ignite-toggle",
	context: { on: false, label: "Notifications" },
	on: {
		TOGGLE: { actions: assign({ on: ({ context }) => !context.on }) },
		SET_LABEL: { actions: assign({ label: ({ event }) => event.label }) },
	},
});

const toggle = igniteCore({
	source: toggleMachine,
	view: ({ context }) => ({ on: context.on, label: context.label }),
	commands: ({ actor }) => ({
		toggle: () => actor.send({ type: "TOGGLE" }),
		// Single-arg `setX` command -> exposed as the `label` string attribute.
		setLabel: (label: string) => actor.send({ type: "SET_LABEL", label }),
	}),
	events: (event) => ({
		// Emitted outward as a CustomEvent; the Vue host listens for `toggled`.
		toggled: event<{ isOn: boolean }>(),
	}),
	effects: ({ snapshot, emit, select }) => {
		const on = select((current) => current.context.on);
		if (!on.changed) return;
		emit("toggled", { isOn: snapshot.context.on });
	},
});

// The framework-neutral handle (a standard custom element). The lit-html view is
// auto-detected and rendered with lit.
export const igniteToggle = toggle(
	"ignite-toggle",
	({ on, label }) => html`
		<style>
			.toggle {
				display: inline-flex;
				gap: 0.85rem;
				align-items: center;
				font: 600 1rem system-ui, sans-serif;
				padding: 0.7rem 1.1rem;
				border-radius: 999px;
				border: 1px solid #334155;
				background: linear-gradient(135deg, #1e293b, #111c33);
				color: #cbd5e1;
				transition: border-color 0.2s ease, background 0.2s ease;
			}
			.toggle[data-on="true"] {
				border-color: rgba(52, 211, 153, 0.55);
				background: linear-gradient(135deg, #06281e, #0f3d2e);
			}
			.toggle-label {
				letter-spacing: 0.01em;
			}
			.toggle-state {
				font: 700 0.78rem system-ui, sans-serif;
				font-variant: small-caps;
				letter-spacing: 0.06em;
				padding: 0.15rem 0.6rem;
				border-radius: 999px;
				background: #334155;
				color: #94a3b8;
			}
			.toggle[data-on="true"] .toggle-state {
				background: rgba(52, 211, 153, 0.18);
				color: #6ee7b7;
			}
		</style>
		<div class="toggle" data-on=${on}>
			<span class="toggle-label">${label}</span>
			<span class="toggle-state">${on ? "On" : "Off"}</span>
		</div>
	`,
);
