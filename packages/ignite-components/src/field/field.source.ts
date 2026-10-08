import { assign, setup } from "xstate";

export type FieldInput = {
	label?: string;
	value?: string;
	hint?: string | null;
	error?: string | null;
	required?: boolean;
	multiline?: boolean;
	touched?: boolean;
};

export type FieldContext = {
	label: string;
	value: string;
	hint: string | null;
	error: string | null;
	required: boolean;
	multiline: boolean;
	touched: boolean;
};

export type FieldEvent =
	| { type: "SET_LABEL"; label: string }
	| { type: "SET_VALUE"; value: string }
	| { type: "SET_HINT"; hint: string | null }
	| { type: "SET_ERROR"; error: string | null }
	| { type: "SET_REQUIRED"; required: boolean }
	| { type: "SET_MULTILINE"; multiline: boolean }
	| { type: "TOUCH" };

/** The draft is the exact string. Leading and trailing spaces stay. */
export function exactDraft(value: string | null): string {
	return value ?? "";
}

export function normalizeOptional(value: string | null): string | null {
	if (value === null || value.length === 0) return null;
	return value;
}

/**
 * The host owns the validation rule.
 * SET_VALUE stores the draft and does not clear or invent an error.
 */
export const fieldMachine = setup({
	types: {
		context: {} as FieldContext,
		events: {} as FieldEvent,
		input: {} as FieldInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) => (event.type === "SET_LABEL" ? event.label : ""),
		}),
		applyValue: assign({
			value: ({ event }) =>
				event.type === "SET_VALUE" ? exactDraft(event.value) : "",
		}),
		applyHint: assign({
			hint: ({ event }) =>
				event.type === "SET_HINT" ? normalizeOptional(event.hint) : null,
		}),
		applyError: assign({
			error: ({ event }) =>
				event.type === "SET_ERROR" ? normalizeOptional(event.error) : null,
		}),
		clearError: assign({
			error: () => null,
		}),
		applyRequired: assign({
			required: ({ event }) =>
				event.type === "SET_REQUIRED" ? event.required : false,
		}),
		applyMultiline: assign({
			multiline: ({ event }) =>
				event.type === "SET_MULTILINE" ? event.multiline : false,
		}),
		markTouched: assign({
			touched: () => true,
		}),
	},
	guards: {
		hasError: ({ event }) =>
			event.type === "SET_ERROR" && normalizeOptional(event.error) !== null,
		contextHasError: ({ context }) => normalizeOptional(context.error) !== null,
	},
}).createMachine({
	id: "field",
	initial: "clean",
	context: ({ input }) => ({
		label: input?.label ?? "",
		value: exactDraft(input?.value ?? ""),
		hint: normalizeOptional(input?.hint ?? null),
		error: normalizeOptional(input?.error ?? null),
		required: input?.required ?? false,
		multiline: input?.multiline ?? false,
		touched: input?.touched ?? false,
	}),
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_VALUE: { actions: "applyValue" },
		SET_HINT: { actions: "applyHint" },
		SET_REQUIRED: { actions: "applyRequired" },
		SET_MULTILINE: { actions: "applyMultiline" },
		TOUCH: { actions: "markTouched" },
	},
	states: {
		clean: {
			always: {
				guard: "contextHasError",
				target: "invalid",
			},
			on: {
				SET_ERROR: {
					guard: "hasError",
					target: "invalid",
					actions: "applyError",
				},
			},
		},
		invalid: {
			on: {
				SET_ERROR: [
					{ guard: "hasError", actions: "applyError" },
					{ target: "clean", actions: "clearError" },
				],
			},
		},
	},
});
