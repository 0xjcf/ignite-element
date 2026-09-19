/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { assign, createMachine } from "xstate";

const toggleMachine = createMachine(
	{
		context: { count: 0 },
		initial: "off",
		states: {
			off: { on: { FLIP: { target: "on", actions: "countFlip" } } },
			on: { on: { FLIP: { target: "off", actions: "countFlip" } } },
		},
	},
	{
		actions: {
			countFlip: assign({ count: ({ context }) => context.count + 1 }),
		},
	},
);

export const core = igniteCore({
	source: toggleMachine,
	states: (snapshot) => ({
		isOn: snapshot.matches("on"),
		label: snapshot.matches("on") ? "On" : "Off",
		count: snapshot.context.count,
	}),
	commands: ({ source }) => ({
		toggle: () => source.send({ type: "FLIP" }),
	}),
});

core("ignite-light-switch", (ctx) => (
	<section class="light-switch" data-state={ctx.label}>
		<link
			rel="stylesheet"
			href={new URL("./light-switch.css", import.meta.url).href}
		/>
		<svg class="bulb" viewBox="0 0 64 80" aria-hidden="true">
			<path d="M22 56C22 46 10 44 10 28a22 22 0 0 1 44 0c0 16-12 18-12 28Z" />
			<path d="M23 64h18M26 72h12" />
		</svg>
		<p class="state">{ctx.label}</p>
		<p class="count">Toggled: {ctx.count}</p>
		<button
			type="button"
			role="switch"
			aria-label="Light"
			aria-checked={String(ctx.isOn)}
			onClick={() => ctx.toggle()}
		>
			<span class="track" aria-hidden="true">
				<span class="thumb" />
			</span>
			Flip
		</button>
	</section>
));
