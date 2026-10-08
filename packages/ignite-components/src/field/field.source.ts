import { assign, emit, setup } from "xstate";
import { createInstanceId } from "../live-status/live-status.source";

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
	instanceId: string;
	label: string;
	value: string;
	hint: string | null;
	error: string | null;
	errorAnnouncement: string | null;
	/** Set when the same sentence must be announced again after a draft change. */
	repeatError: string | null;
	errorEpoch: number;
	draftSinceError: boolean;
	paintNonce: number;
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
	| { type: "TOUCH" }
	| { type: "REVEAL" };

/** The draft is the exact string. Leading and trailing spaces stay. */
export function exactDraft(value: string | null): string {
	return value ?? "";
}

export type FieldEmitted =
	| { type: "input"; value: string }
	| { type: "touch"; value: string };

/** A whitespace-only hint is absent. A hint with words is kept exact. */
export function normalizeOptional(value: string | null): string | null {
	if (value === null) return null;
	if (value.trim().length === 0) return null;
	return value;
}

export const ERROR_CLEARED = "Error cleared.";

/** A whitespace-only error is absent. A real sentence is trimmed. */
export function normalizeError(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed;
}

/**
 * The host owns the validation rule.
 * SET_VALUE stores the draft, emits it, and does not clear or invent an error.
 * TOUCH emits the same draft so blur can validate.
 */
export const fieldMachine = setup({
	types: {
		context: {} as FieldContext,
		events: {} as FieldEvent,
		emitted: {} as FieldEmitted,
		input: {} as FieldInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) => (event.type === "SET_LABEL" ? event.label : ""),
		}),
		applyValue: assign(({ context, event }) => {
			if (event.type !== "SET_VALUE") return {};
			const value = exactDraft(event.value);
			return {
				value,
				draftSinceError:
					value !== context.value ? true : context.draftSinceError,
			};
		}),
		applyHint: assign({
			hint: ({ event }) =>
				event.type === "SET_HINT" ? normalizeOptional(event.hint) : null,
		}),
		applyError: assign(({ context, event }) => {
			if (event.type !== "SET_ERROR") return {};
			const error = normalizeError(event.error);
			const repeat =
				error !== null &&
				error === context.errorAnnouncement &&
				context.draftSinceError;
			return {
				error,
				errorAnnouncement: repeat ? "" : error,
				repeatError: repeat ? error : null,
				errorEpoch: context.errorEpoch + 1,
				draftSinceError: false,
			};
		}),
		clearError: assign({
			error: () => null,
			errorAnnouncement: () => ERROR_CLEARED,
			repeatError: () => null,
			draftSinceError: () => false,
		}),
		reveal: assign(({ context }) => {
			const restored = context.repeatError
				? context.repeatError
				: context.errorAnnouncement && context.errorAnnouncement.length > 0
					? context.errorAnnouncement
					: context.error;
			return {
				paintNonce: context.paintNonce + 1,
				errorAnnouncement: restored,
				repeatError: null,
			};
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
		announceInput: emit(({ context }) => ({
			type: "input" as const,
			value: exactDraft(context.value),
		})),
		announceTouch: emit(({ context }) => ({
			type: "touch" as const,
			value: exactDraft(context.value),
		})),
	},
	guards: {
		hasError: ({ event }) =>
			event.type === "SET_ERROR" && normalizeError(event.error) !== null,
		contextHasError: ({ context }) => normalizeError(context.error) !== null,
		draftChanged: ({ context, event }) =>
			event.type === "SET_VALUE" && exactDraft(event.value) !== context.value,
	},
}).createMachine({
	id: "field",
	initial: "clean",
	context: ({ input }) => {
		const error = normalizeError(input?.error ?? null);
		return {
			instanceId: createInstanceId("field"),
			label: input?.label ?? "",
			value: exactDraft(input?.value ?? ""),
			hint: normalizeOptional(input?.hint ?? null),
			error,
			errorAnnouncement: null,
			repeatError: null,
			errorEpoch: 0,
			draftSinceError: false,
			paintNonce: 0,
			required: input?.required ?? false,
			multiline: input?.multiline ?? false,
			touched: input?.touched ?? false,
		};
	},
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_VALUE: [
			{
				guard: "draftChanged",
				actions: ["applyValue", "announceInput"],
			},
			{ actions: "applyValue" },
		],
		SET_HINT: { actions: "applyHint" },
		SET_REQUIRED: { actions: "applyRequired" },
		SET_MULTILINE: { actions: "applyMultiline" },
		TOUCH: { actions: ["markTouched", "announceTouch"] },
		REVEAL: { actions: "reveal" },
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
