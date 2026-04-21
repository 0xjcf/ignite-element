import { assign, setup } from "xstate";

export interface ApiShowcaseContext {
	count: number;
	limit: number;
	step: number;
	lastCommand: string;
	history: string[];
}

export type ApiShowcaseEvent =
	| { type: "ADD"; amount: number }
	| { type: "DECREMENT" }
	| { type: "SET_LIMIT"; limit: number }
	| { type: "SET_STEP"; step: number }
	| { type: "RESET" };

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const appendHistory = (history: ApiShowcaseContext["history"], entry: string) =>
	[...history, entry].slice(-5);

export const apiShowcaseMachine = setup({
	types: {
		context: {} as ApiShowcaseContext,
		events: {} as ApiShowcaseEvent,
	},
}).createMachine({
	id: "apiShowcase",
	initial: "active",
	context: {
		count: 0,
		limit: 5,
		step: 1,
		lastCommand: "ready",
		history: ["Ready"],
	},
	states: {
		active: {
			always: {
				target: "limited",
				guard: ({ context }) => context.count >= context.limit,
			},
			on: {
				ADD: {
					actions: assign({
						count: ({ context, event }) =>
							clamp(context.count + event.amount, 0, context.limit),
						lastCommand: ({ event }) => `add ${event.amount}`,
						history: ({ context, event }) => {
							const nextCount = clamp(
								context.count + event.amount,
								0,
								context.limit,
							);
							return appendHistory(
								context.history,
								`Added ${event.amount}; count is ${nextCount}`,
							);
						},
					}),
				},
				DECREMENT: {
					actions: assign({
						count: ({ context }) => clamp(context.count - 1, 0, context.limit),
						lastCommand: () => "decrement",
						history: ({ context }) => {
							const nextCount = clamp(context.count - 1, 0, context.limit);
							return appendHistory(
								context.history,
								`Decremented; count is ${nextCount}`,
							);
						},
					}),
				},
				SET_LIMIT: {
					actions: assign({
						limit: ({ event }) => event.limit,
						count: ({ context, event }) => clamp(context.count, 0, event.limit),
						lastCommand: ({ event }) => `limit ${event.limit}`,
						history: ({ context, event }) =>
							appendHistory(context.history, `Limit set to ${event.limit}`),
					}),
				},
				SET_STEP: {
					actions: assign({
						step: ({ event }) => event.step,
						lastCommand: ({ event }) => `step ${event.step}`,
						history: ({ context, event }) =>
							appendHistory(context.history, `Step set to ${event.step}`),
					}),
				},
				RESET: {
					actions: assign({
						count: () => 0,
						lastCommand: () => "reset",
						history: ({ context }) =>
							appendHistory(context.history, "Reset to zero"),
					}),
				},
			},
		},
		limited: {
			always: {
				target: "active",
				guard: ({ context }) => context.count < context.limit,
			},
			on: {
				DECREMENT: {
					actions: assign({
						count: ({ context }) => clamp(context.count - 1, 0, context.limit),
						lastCommand: () => "decrement",
						history: ({ context }) => {
							const nextCount = clamp(context.count - 1, 0, context.limit);
							return appendHistory(
								context.history,
								`Decremented; count is ${nextCount}`,
							);
						},
					}),
				},
				SET_LIMIT: {
					actions: assign({
						limit: ({ event }) => event.limit,
						count: ({ context, event }) => clamp(context.count, 0, event.limit),
						lastCommand: ({ event }) => `limit ${event.limit}`,
						history: ({ context, event }) =>
							appendHistory(context.history, `Limit set to ${event.limit}`),
					}),
				},
				SET_STEP: {
					actions: assign({
						step: ({ event }) => event.step,
						lastCommand: ({ event }) => `step ${event.step}`,
						history: ({ context, event }) =>
							appendHistory(context.history, `Step set to ${event.step}`),
					}),
				},
				RESET: {
					actions: assign({
						count: () => 0,
						lastCommand: () => "reset",
						history: ({ context }) =>
							appendHistory(context.history, "Reset to zero"),
					}),
				},
			},
		},
	},
});
