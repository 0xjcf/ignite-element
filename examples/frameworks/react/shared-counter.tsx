import { useIgnite } from "ignite-element/react";
import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, createMachine } from "xstate";

// Application bootstrap, never React rendering. The actor remains caller-owned.
export const source = createActor(
	createMachine({
		context: { count: 0 },
		on: {
			INCREMENT: {
				actions: assign({ count: ({ context }) => context.count + 1 }),
			},
		},
	}),
).start();
export const core = igniteCore({
	source,
	states: (snapshot) => ({
		count: snapshot.context.count,
		canIncrement: snapshot.can({ type: "INCREMENT" }),
	}),
	commands: ({ actor }) => ({
		increment: () => actor.send({ type: "INCREMENT" }),
	}),
});
export function Counter() {
	const ctx = useIgnite(core);
	return (
		<button
			type="button"
			disabled={!ctx.canIncrement}
			onClick={() => ctx.increment()}
		>
			{ctx.count}
		</button>
	);
}
export function SharedCounters() {
	return (
		<>
			<Counter />
			<Counter />
		</>
	);
}
// Final application teardown: core.dispose(); source.stop();
