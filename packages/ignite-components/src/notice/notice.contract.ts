import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Inline message about a state. The host decides the reason.
 * Tones are info, warning, error, stale, and ai-off. Words carry the tone.
 */
export const noticeContract = {
	name: "Notice",
	states: ["shown", "dismissed"],
	flags: [
		{
			name: "showNotice",
			kind: "show",
			reasonField: "showNoticeRefusal",
			reason: "This notice was dismissed.",
		},
		{
			name: "canDismiss",
			kind: "can",
			reasonField: "canDismissRefusal",
			reason: "This notice stays until the host clears it.",
		},
		{
			name: "isDismissed",
			kind: "is",
			reasonField: "isDismissedRefusal",
			reason: "This notice is still showing.",
		},
		{
			name: "showActions",
			kind: "show",
			reasonField: "showActionsRefusal",
			reason: "There is no recovery action.",
		},
		{
			name: "canRecover",
			kind: "can",
			reasonField: "canRecoverRefusal",
			reason: "There is no recovery action.",
		},
		{
			name: "isRecoveryRequested",
			kind: "is",
			reasonField: "isRecoveryRequestedRefusal",
			reason: "No recovery was requested.",
		},
	],
	commands: [
		{ name: "dismiss", kind: "action", flag: "canDismiss" },
		{ name: "recover", kind: "action", flag: "canRecover" },
		{ name: "show", kind: "configuration" },
		{ name: "setTone", kind: "configuration", attribute: "tone" },
		{ name: "setMessage", kind: "configuration", attribute: "message" },
		{ name: "setActions", kind: "configuration", attribute: "actions" },
		{ name: "setDismissible", kind: "configuration", attribute: "dismissible" },
		{ name: "setFocusTarget", kind: "configuration" },
		{
			name: "setFocustarget",
			kind: "configuration",
			attribute: "focustarget",
		},
	],
	events: ["recover"],
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
		cli: "stderr line or warning field",
		mcp: "warning field in a structured result",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
	a11y: [
		{
			web: "After dismiss or recover, focus moves to a defined target.",
			cli: "Print the next suggested command.",
			mcp: "focusTarget in the result.",
		},
		{
			web: "Two notices on one page use different ids.",
			cli: "Instance id in the output.",
			mcp: "instanceId in the result.",
		},
		{
			web: "Recover fires once.",
			cli: "The recover command is idempotent.",
			mcp: "A repeat returns the first outcome.",
		},
	],
} as const satisfies ComponentContract;
