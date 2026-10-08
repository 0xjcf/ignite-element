import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Bound to one host command. The button reads canPress. It does not decide it.
 * press is the person's action. allow, refuse, settle, and the label setters
 * are how the host reports the flag, the pending label, and the outcome.
 */
export const actionButtonContract = {
	name: "ActionButton",
	states: ["idle", "pending", "unavailable"],
	flags: [
		{
			name: "canPress",
			kind: "can",
			reasonField: "canPressRefusal",
			reason: "This action is already running.",
		},
		{
			name: "showReason",
			kind: "show",
			reasonField: "showReasonRefusal",
			reason: "No reason was given.",
		},
		{
			name: "isPending",
			kind: "is",
			reasonField: "isPendingRefusal",
			reason: "This action is not running.",
		},
	],
	commands: [
		{ name: "press", kind: "action", flag: "canPress" },
		{ name: "settle", kind: "configuration" },
		{ name: "allow", kind: "configuration" },
		{ name: "refuse", kind: "configuration" },
		{ name: "setLabel", kind: "configuration", attribute: "label" },
		{ name: "setPendingLabel", kind: "configuration" },
		{
			name: "setPendinglabel",
			kind: "configuration",
			attribute: "pendinglabel",
		},
	],
	events: ["press"],
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
		cli: "n/a itself; the bound command is the CLI verb",
		mcp: "n/a itself; the bound command is the MCP tool",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;
