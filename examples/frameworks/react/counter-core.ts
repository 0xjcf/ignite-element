import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, createMachine } from "xstate";

const counterMachine = createMachine({
	types: {} as {
		events:
			| { type: "INCREMENT" }
			| { type: "DECREMENT" }
			| { type: "LABEL"; value: string };
	},
	context: { count: 0, label: "Visitors" },
	on: {
		INCREMENT: {
			actions: assign({ count: ({ context }) => context.count + 1 }),
		},
		DECREMENT: {
			actions: assign({ count: ({ context }) => context.count - 1 }),
		},
		LABEL: {
			actions: assign({ label: ({ event }) => event.value }),
		},
	},
});

// The application starts this shared actor and owns its shutdown.
export const source = createActor(counterMachine).start();

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
