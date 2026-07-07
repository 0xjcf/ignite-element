/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { assign, setup } from "xstate";
import styles from "./counter.css?raw";

// A small, real ignite element authored exactly as you would for any host —
// framework-neutral. Registration returns a typed handle (tagName + getSchema +
// phantom Commands/Events). The React binding lives beside it in
// `counter.react.ts` (`igniteReact(counterElement)`); the same handle could
// equally get a Vue/Svelte/Angular binding.
//
// The view is authored with ignite-JSX — the default, config-free v3 renderer
// (no renderer registration needed). The per-file `@jsxImportSource` pragma at
// the top routes THIS file's JSX through ignite-JSX. This file authors NO React
// JSX, so there is no transform conflict; App.tsx / main.tsx stay on React JSX
// via @vitejs/plugin-react.
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

const counterCore = igniteCore({
	source: counterMachine,
	view: ({ snapshot }) => ({
		count: snapshot.context.count,
		label: snapshot.context.label,
	}),
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
		emit({ type: "countChanged", count: snapshot.context.count });
	},
});

// The framework-neutral handle: a standard custom element + getSchema(). This is
// the unit a host (or an agent) consumes; the React wrapper derives from it. The
// view injects counter.css into its Shadow DOM via a raw <style> (document CSS
// can't reach shadow content) — the config-free styling path.
export const counterElement = counterCore("react-demo-counter", (ctx) => (
	<>
		<style>{styles}</style>
		<div class="counter-card">
			<span class="counter-label">{ctx.label}: </span>
			<output class="counter-value">{ctx.count}</output>
		</div>
	</>
));
