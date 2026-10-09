import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Label, exact draft, hint, and a linked error.
 * The host owns the validation rule. The field does not trim the draft.
 */
export const fieldContract = {
	name: "Field",
	states: ["clean", "invalid"],
	flags: [
		{
			name: "showError",
			kind: "show",
			reasonField: "showErrorRefusal",
			reason: "There is no error.",
		},
		{
			name: "showHint",
			kind: "show",
			reasonField: "showHintRefusal",
			reason: "There is no hint.",
		},
		{
			name: "isInvalid",
			kind: "is",
			reasonField: "isInvalidRefusal",
			reason: "The host has not reported an error.",
		},
		{
			name: "isRequired",
			kind: "is",
			reasonField: "isRequiredRefusal",
			reason: "This field is optional.",
		},
		{
			name: "isTouched",
			kind: "is",
			reasonField: "isTouchedRefusal",
			reason: "This field has not been touched.",
		},
		{
			name: "isMultiline",
			kind: "is",
			reasonField: "isMultilineRefusal",
			reason: "This field is a single line.",
		},
	],
	commands: [
		{ name: "touch", kind: "action" },
		{ name: "setLabel", kind: "configuration", attribute: "label" },
		{ name: "setValue", kind: "configuration", attribute: "value" },
		{ name: "setHint", kind: "configuration", attribute: "hint" },
		{ name: "setError", kind: "configuration", attribute: "error" },
		{ name: "setRequired", kind: "configuration", attribute: "required" },
		{ name: "setMultiline", kind: "configuration", attribute: "multiline" },
	],
	events: ["input", "touch"],
	slots: [],
	tokens: [...catalogTokens],
	layers: {
		tokens: true,
		props: true,
		slots: false,
		headless: true,
	},
	surfaces: {
		web: "custom element; the caller chooses the tag",
		pwa: "same element, no network",
		cli: "flag or prompt",
		mcp: "tool input property; the schema comes from the host",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
	a11y: [
		{
			web: "Assertive live region when an error is set and when it is cleared.",
			cli: "Error names the flag, exit 2, hint on stderr.",
			mcp: "errors[{field, message, hint}].",
		},
		{
			web: "A whitespace-only hint is absent.",
			cli: "Whitespace hint is omitted from stderr.",
			mcp: "Whitespace hint stays in the schema description only when it has words.",
		},
		{
			web: "One input event per edit.",
			cli: "One error line per rejected flag.",
			mcp: "One errors entry per field.",
		},
		{
			web: "Hint and error ids are unique per field.",
			cli: "Instance id in the output.",
			mcp: "instanceId in the result.",
		},
	],
} as const satisfies ComponentContract;
