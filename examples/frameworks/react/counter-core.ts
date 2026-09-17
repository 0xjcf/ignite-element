import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, createMachine } from "xstate";

// Application bootstrap, never React rendering. The actor remains caller-owned.
export const source = createActor(
	createMachine({
		types: {} as {
			events:
				| { type: "INCREMENT" }
				| { type: "DECREMENT" }
				| { type: "LABEL"; value: string };
		},
		context: { count: 0, label: "Visitors" },
		on: {
			DECREMENT: {
				actions: assign({ count: ({ context }) => context.count - 1 }),
			},
			LABEL: {
				actions: assign({
					label: ({ event }) =>
						event.type === "LABEL" ? event.value : "Visitors",
				}),
			},
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
		label: snapshot.context.label,
		canIncrement: snapshot.can({ type: "INCREMENT" }),
	}),
	commands: ({ source: actor }) => ({
		increment: () => actor.send({ type: "INCREMENT" }),
		decrement: () => actor.send({ type: "DECREMENT" }),
		setLabel: (value: string) => actor.send({ type: "LABEL", value }),
	}),
});
