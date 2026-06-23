import { assign, setup } from "xstate";

type CounterContext = {
	count: number;
};

type CounterEvent = { type: "START" } | { type: "INC" } | { type: "DEC" };

const counterMachine = setup({
	types: {
		context: {} as CounterContext,
		events: {} as CounterEvent,
	},
}).createMachine({
	id: "counter",
	initial: "idle",
	context: {
		count: 0,
	},
	states: {
		idle: {
			on: {
				START: {
					target: "active",
				},
			},
		},
		active: {},
	},
	on: {
		INC: {
			actions: assign({
				count: ({ context }) => context.count + 1,
			}),
		},

		DEC: {
			actions: assign({
				count: ({ context }) => context.count - 1,
			}),
		},
	},
});

export default counterMachine;
