import { igniteCore } from "ignite-element/xstate";
import { html } from "lit-html";
import { assign, setup } from "xstate";

// A small, real ignite element authored exactly as you would for any host.
// Registration now returns a typed handle (tagName + getSchema + phantom
// Commands/Events), which `igniteReact` consumes to generate the React wrapper.
//
// The element's internal view uses a lit-html template (no JSX) so this file
// stays free of the React/ignite-jsx pragma split — App.tsx owns the React JSX.
const counterMachine = setup({
	types: {} as {
		context: { count: number; label: string };
		events:
			| { type: "INC" }
			| { type: "DEC" }
			| { type: "SET_LABEL"; label: string };
	},
}).createMachine({
	id: "react-demo-counter",
	context: { count: 0, label: "Counter" },
	on: {
		INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
		DEC: { actions: assign({ count: ({ context }) => context.count - 1 }) },
		SET_LABEL: {
			actions: assign({ label: ({ event }) => event.label }),
		},
	},
});

export const Counter = igniteCore({
	source: counterMachine,
	view: ({ context }) => ({ count: context.count, label: context.label }),
	commands: ({ actor }) => ({
		increment: () => actor.send({ type: "INC" }),
		decrement: () => actor.send({ type: "DEC" }),
		// Single-arg `setX` command -> exposed as the `label` attribute AND prop.
		setLabel: (label: string) => actor.send({ type: "SET_LABEL", label }),
	}),
	events: (event) => ({
		// Emitted outward as a CustomEvent; igniteReact surfaces it as
		// `onCountChanged` receiving the flat payload.
		countChanged: event<{ count: number }>(),
	}),
	effects: ({ snapshot, emit, select }) => {
		const count = select((current) => current.context.count);
		if (!count.changed) return;
		emit("countChanged", { count: snapshot.context.count });
	},
})(
	"react-demo-counter",
	({ count, label }) => html`
		<div class="counter-card">
			<span class="counter-label">${label}</span>
			<output class="counter-value">${count}</output>
		</div>
	`,
);
