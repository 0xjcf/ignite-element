import { assign, fromPromise, setup } from "xstate";

export type PreferenceRequest = {
	account: string;
	generation: number;
	value: string;
};
export type PreferenceReceipt = PreferenceRequest & {
	outcome: "confirmed" | "rejected";
};
export type PreferencePorts = {
	save(request: PreferenceRequest): Promise<PreferenceReceipt>;
};
type Input = { ports: PreferencePorts; uncertaintyMs: number };
type Context = Input & {
	account: string | null;
	generation: number;
	value: string;
	requested: string;
};

export const preferenceMachine = setup({
	types: {} as {
		context: Context;
		input: Input;
		events:
			| { type: "SIGN_IN"; account: string; initial: string }
			| { type: "SIGN_OUT" }
			| { type: "SAVE"; value: string; generation: number };
	},
	actors: {
		save: fromPromise(
			({
				input,
			}: {
				input: { ports: PreferencePorts; request: PreferenceRequest };
			}) => input.ports.save(input.request),
		),
	},
	delays: { uncertainty: ({ context }) => context.uncertaintyMs },
	guards: {
		currentIntent: ({ context, event }) =>
			event.type === "SAVE" && event.generation === context.generation,
	},
	actions: {
		signIn: assign(({ context, event }) =>
			event.type === "SIGN_IN"
				? {
						account: event.account,
						generation: context.generation + 1,
						value: event.initial,
						requested: "",
					}
				: {},
		),
		signOut: assign(({ context }) => ({
			account: null,
			generation: context.generation + 1,
			value: "",
			requested: "",
		})),
		request: assign(({ event }) =>
			event.type === "SAVE" ? { requested: event.value } : {},
		),
	},
}).createMachine({
	id: "preference",
	context: ({ input }) => ({
		...input,
		account: null,
		generation: 0,
		value: "",
		requested: "",
	}),
	initial: "signedOut",
	states: {
		signedOut: { on: { SIGN_IN: { target: "active", actions: "signIn" } } },
		active: {
			initial: "idle",
			on: {
				SIGN_IN: { target: "active", reenter: true, actions: "signIn" },
				SIGN_OUT: { target: "signedOut", actions: "signOut" },
			},
			states: {
				idle: {
					on: {
						SAVE: {
							guard: "currentIntent",
							target: "saving",
							actions: "request",
						},
					},
				},
				saving: {
					initial: "pending",
					invoke: {
						src: "save",
						input: ({ context }) => {
							if (context.account === null)
								throw Error("No account owns this request");
							return {
								ports: context.ports,
								request: {
									account: context.account,
									generation: context.generation,
									value: context.requested,
								},
							};
						},
						onDone: [
							{
								guard: ({ context, event }) =>
									event.output.account === context.account &&
									event.output.generation === context.generation &&
									event.output.outcome === "confirmed",
								target: "confirmed",
								actions: assign({ value: ({ event }) => event.output.value }),
							},
							{
								guard: ({ context, event }) =>
									event.output.account === context.account &&
									event.output.generation === context.generation &&
									event.output.outcome === "rejected",
								target: "rejected",
							},
							{ target: ".unknown" },
						],
						onError: ".unknown",
					},
					// The receipt invocation outlives pending, but not its signed-in source state.
					states: {
						pending: { after: { uncertainty: "unknown" } },
						unknown: {},
					},
				},
				confirmed: {
					on: {
						SAVE: {
							guard: "currentIntent",
							target: "saving",
							actions: "request",
						},
					},
				},
				rejected: {
					on: {
						SAVE: {
							guard: "currentIntent",
							target: "saving",
							actions: "request",
						},
					},
				},
			},
		},
	},
});
