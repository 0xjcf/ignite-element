import { assign, fromPromise, setup } from "xstate";
import {
	emptyValues,
	type FormErrors,
	type FormField,
	type FormValues,
	validateAll,
	validateField,
} from "./validation";

export interface FormContext {
	values: FormValues;
	errors: FormErrors;
	touched: Partial<Record<FormField, boolean>>;
	submitError: string | null;
}

export type FormEvent =
	| { type: "SET_FIELD"; field: FormField; value: string }
	| { type: "BLUR_FIELD"; field: FormField }
	| { type: "SUBMIT" }
	| { type: "RESET" };

// The "server". A real app calls its API here; the demo resolves after a short
// delay, and rejects for one address to exercise the submit-error path. This is
// the one async seam, modelled as an XState actor (side-effects belong in the
// actor, not in `assign`).
export const SUBMIT_DELAY_MS = 600;
export const TAKEN_EMAIL = "taken@example.com";

const submitForm = fromPromise<void, FormValues>(async ({ input }) => {
	await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
	if (input.email === TAKEN_EMAIL) {
		throw new Error("That email is already registered");
	}
});

const initialContext: FormContext = {
	values: emptyValues,
	errors: {},
	touched: {},
	submitError: null,
};

export const formMachine = setup({
	types: {} as {
		context: FormContext;
		events: FormEvent;
	},
	actors: { submitForm },
	actions: {
		resetForm: assign(() => initialContext),
	},
	guards: {
		isFormValid: ({ context }) =>
			Object.keys(validateAll(context.values)).length === 0,
	},
}).createMachine({
	id: "signup-form",
	context: initialContext,
	initial: "editing",
	states: {
		editing: {
			on: {
				SET_FIELD: {
					actions: assign({
						values: ({ context, event }) => ({
							...context.values,
							[event.field]: event.value,
						}),
						// Re-validate only a field the user has already touched, so a
						// corrected value clears its error live without flagging fields
						// they have not reached yet.
						errors: ({ context, event }) => {
							if (!context.touched[event.field]) return context.errors;
							const next = { ...context.errors };
							const error = validateField(event.field, event.value);
							if (error) next[event.field] = error;
							else delete next[event.field];
							return next;
						},
						submitError: () => null,
					}),
				},
				BLUR_FIELD: {
					actions: assign({
						touched: ({ context, event }) => ({
							...context.touched,
							[event.field]: true,
						}),
						errors: ({ context, event }) => {
							const next = { ...context.errors };
							const error = validateField(
								event.field,
								context.values[event.field],
							);
							if (error) next[event.field] = error;
							else delete next[event.field];
							return next;
						},
					}),
				},
				SUBMIT: [
					{ guard: "isFormValid", target: "submitting" },
					{
						// Invalid: reveal every error and mark all fields touched.
						actions: assign({
							errors: ({ context }) => validateAll(context.values),
							touched: () => ({ name: true, email: true, password: true }),
						}),
					},
				],
				RESET: { actions: "resetForm" },
			},
		},
		submitting: {
			invoke: {
				src: "submitForm",
				input: ({ context }) => context.values,
				onDone: { target: "success" },
				onError: {
					target: "editing",
					actions: assign({
						submitError: ({ event }) =>
							event.error instanceof Error
								? event.error.message
								: "Something went wrong. Please try again.",
					}),
				},
			},
		},
		success: {
			on: { RESET: { target: "editing", actions: "resetForm" } },
		},
	},
});
