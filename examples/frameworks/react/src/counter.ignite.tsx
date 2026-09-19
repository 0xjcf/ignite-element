/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { assign, createMachine } from "xstate";

const counterMachine = createMachine({
	context: { count: 0 },
	on: {
		INCREMENT: {
			actions: assign({ count: ({ context }) => context.count + 1 }),
		},
		DECREMENT: {
			actions: assign({ count: ({ context }) => context.count - 1 }),
		},
	},
});

const counterCore = igniteCore({
	source: counterMachine,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source }) => ({
		increment: () => source.send({ type: "INCREMENT" }),
		decrement: () => source.send({ type: "DECREMENT" }),
	}),
	events: (event) => ({
		countChanged: event<{ count: number }>(),
	}),
	effects: ({ emit, select }) => {
		const count = select((snapshot) => snapshot.context.count);
		if (count.changed) emit({ type: "countChanged", count: count.current });
	},
});

export const counterElement = counterCore("react-demo-counter", (ctx) => (
	<section class="counter-card" aria-label="Ignite counter">
		<link
			rel="stylesheet"
			href={new URL("./counter.css", import.meta.url).href}
		/>
		<p>Custom element</p>
		<output aria-label="Element count">{ctx.count}</output>
		<div class="counter-controls">
			<button
				type="button"
				aria-label="Decrement"
				onClick={() => ctx.decrement()}
			>
				−
			</button>
			<button
				type="button"
				aria-label="Increment"
				onClick={() => ctx.increment()}
			>
				+
			</button>
		</div>
	</section>
));
