import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import type { HeadlessA11y } from "../contract";
import { cliTone } from "../live-status/live-status.source";
import {
	ERROR_CLEARED,
	exactDraft,
	type FieldEvent,
	fieldMachine,
	normalizeError,
	normalizeOptional,
} from "./field.source";

export type FieldStateName = "clean" | "invalid";

export type FieldStates = {
	state: FieldStateName;
	instanceId: string;
	label: string;
	value: string;
	hint: string | null;
	error: string | null;
	errorAnnouncement: string | null;
	required: boolean;
	multiline: boolean;
	touched: boolean;
	showError: boolean;
	showErrorRefusal: string | null;
	showHint: boolean;
	showHintRefusal: string | null;
	isInvalid: boolean;
	isInvalidRefusal: string | null;
	isRequired: boolean;
	isRequiredRefusal: string | null;
	isTouched: boolean;
	isTouchedRefusal: string | null;
	isMultiline: boolean;
	isMultilineRefusal: string | null;
	a11y: HeadlessA11y;
};

export type FieldCommands = {
	setLabel: (label: string | null) => void;
	setValue: (value: string | null) => void;
	setHint: (hint: string | null) => void;
	setError: (error: string | null) => void;
	setRequired: (required: string | null) => void;
	setMultiline: (multiline: string | null) => void;
	touch: () => void;
};

const NO_ERROR = "There is no error.";
const NO_HINT = "There is no hint.";
const NOT_INVALID = "The host has not reported an error.";
const OPTIONAL = "This field is optional.";
const UNTOUCHED = "This field has not been touched.";
const SINGLE_LINE = "This field is a single line.";

export function projectField(
	snapshot: SnapshotFrom<typeof fieldMachine>,
): FieldStates {
	const invalid = snapshot.matches("invalid");
	const error = invalid ? normalizeError(snapshot.context.error) : null;
	const hint = normalizeOptional(snapshot.context.hint);
	const errorAnnouncement = snapshot.context.errorAnnouncement;
	const required = snapshot.context.required;
	const touched = snapshot.context.touched;
	const multiline = snapshot.context.multiline;
	const label = snapshot.context.label;
	const cli =
		errorAnnouncement === null
			? null
			: errorAnnouncement === ERROR_CLEARED
				? ERROR_CLEARED
				: cliTone("error", errorAnnouncement);
	return {
		state: invalid ? "invalid" : "clean",
		instanceId: snapshot.context.instanceId,
		label,
		value: exactDraft(snapshot.context.value),
		hint,
		error,
		errorAnnouncement,
		required,
		multiline,
		touched,
		showError: error !== null,
		showErrorRefusal: error !== null ? null : NO_ERROR,
		showHint: hint !== null,
		showHintRefusal: hint !== null ? null : NO_HINT,
		isInvalid: invalid,
		isInvalidRefusal: invalid ? null : NOT_INVALID,
		isRequired: required,
		isRequiredRefusal: required ? null : OPTIONAL,
		isTouched: touched,
		isTouchedRefusal: touched ? null : UNTOUCHED,
		isMultiline: multiline,
		isMultilineRefusal: multiline ? null : SINGLE_LINE,
		a11y: {
			cli,
			mcp: {
				value: exactDraft(snapshot.context.value),
				tone: invalid ? "error" : "neutral",
				label,
				reason: error,
				status: errorAnnouncement ? "assertive" : "quiet",
				instanceId: snapshot.context.instanceId,
				warnings: [],
				focusTarget: null,
				errors: error === null ? [] : [{ field: label, message: error, hint }],
				isError: invalid,
			},
		},
	};
}

export function fieldCommands(source: {
	send: (event: FieldEvent) => void;
}): FieldCommands {
	return {
		setLabel: (label) => {
			source.send({ type: "SET_LABEL", label: label ?? "" });
		},
		setValue: (value) => {
			source.send({ type: "SET_VALUE", value: exactDraft(value) });
		},
		setHint: (hint) => {
			source.send({ type: "SET_HINT", hint: normalizeOptional(hint) });
		},
		setError: (error) => {
			source.send({ type: "SET_ERROR", error: normalizeError(error) });
		},
		setRequired: (required) => {
			source.send({ type: "SET_REQUIRED", required: required === "true" });
		},
		setMultiline: (multiline) => {
			source.send({ type: "SET_MULTILINE", multiline: multiline === "true" });
		},
		touch: () => {
			source.send({ type: "TOUCH" });
		},
	};
}

export const fieldProjection = {
	states: projectField,
	commands: ({ source }: { source: Parameters<typeof fieldCommands>[0] }) =>
		fieldCommands(source),
};

export function createFieldCore() {
	return igniteCore({
		source: fieldMachine,
		states: projectField,
		commands: ({ source }) => fieldCommands(source),
		events: (event) => ({
			input: event<{ value: string }>(),
			touch: event<{ value: string }>(),
		}),
	});
}
