/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, createMachine } from "xstate";

const machine = createMachine({
	context: { count: 0 },
	on: {
		INCREMENT: {
			actions: assign({ count: ({ context }) => context.count + 1 }),
		},
	},
});
export const source = createActor(machine).start();
export const core = igniteCore({
	source,
	states: (snapshot) => ({
		count: snapshot.context.count,
		canIncrement: snapshot.can({ type: "INCREMENT" }),
	}),
	commands: ({ source: actor }) => ({
		increment: () => actor.send({ type: "INCREMENT" }),
	}),
});
core("shared-counter", (ctx) => (
	<button
		type="button"
		disabled={!ctx.canIncrement}
		onClick={() => ctx.increment()}
	>
		Count: {ctx.count}
	</button>
));
core("shared-counter-summary", (ctx) => <p>Count: {ctx.count}</p>);
// The application owns source.stop(); navigation only attaches/detaches views.
