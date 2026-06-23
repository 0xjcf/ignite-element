// Test fixture: a minimal XState counter machine used by the library's adapter
// suite. Previously imported from the xstate example app; the fixture now lives
// with the tests so the library test suite does not depend on example source
// (examples live in top-level `examples/`). Kept byte-identical to the example's
// machine so behavior is stable.
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
