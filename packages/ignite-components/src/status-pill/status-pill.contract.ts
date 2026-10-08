import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * StatusPill is a label. It has no action the person invokes.
 * `setValue`, `setTone`, and `setReason` are configuration commands so a
 * custom element can receive those attributes. They do not decide anything.
 */
export const statusPillContract = {
	name: "StatusPill",
	states: ["plain", "withReason"],
	flags: [
		{
			name: "showReason",
			kind: "show",
			reasonField: "showReasonRefusal",
			reason: "No reason was given.",
		},
	],
	commands: [
		{
			name: "setValue",
			kind: "configuration",
			attribute: "value",
		},
		{
			name: "setTone",
			kind: "configuration",
			attribute: "tone",
		},
		{
			name: "setReason",
			kind: "configuration",
			attribute: "reason",
		},
	],
	events: [],
	slots: [],
	tokens: [...catalogTokens, "--status-pill-tone"],
	layers: {
		tokens: true,
		props: true,
		slots: false,
		headless: true,
	},
	surfaces: {
		web: "custom element; the caller chooses the tag",
		pwa: "same element, no network",
		cli: "text label in command output",
		mcp: "rendered as a field in structured results",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;
