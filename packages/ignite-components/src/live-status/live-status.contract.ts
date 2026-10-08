import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Shared announcer. StatusPill, Field, and ExportButton use this
 * instead of their own live regions. CLI and MCP hosts are still M3.
 */
export const liveStatusContract = {
	name: "LiveStatus",
	states: ["quiet", "polite", "assertive", "busy", "settled"],
	flags: [
		{
			name: "isBusy",
			kind: "is",
			reasonField: "isBusyRefusal",
			reason: "Nothing is in progress.",
		},
		{
			name: "showSettled",
			kind: "show",
			reasonField: "showSettledRefusal",
			reason: "There is no settled status.",
		},
		{
			name: "isLive",
			kind: "is",
			reasonField: "isLiveRefusal",
			reason: "There is nothing to announce.",
		},
	],
	commands: [
		{ name: "clear", kind: "action" },
		{ name: "setMessage", kind: "configuration", attribute: "message" },
		{
			name: "setPoliteness",
			kind: "configuration",
			attribute: "politeness",
		},
		{ name: "setBusy", kind: "configuration", attribute: "busy" },
		{ name: "setProgress", kind: "configuration", attribute: "progress" },
		{ name: "setSettled", kind: "configuration", attribute: "settled" },
		{ name: "setTone", kind: "configuration", attribute: "tone" },
		{ name: "setReason", kind: "configuration", attribute: "reason" },
	],
	events: [],
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
		cli: "status lines on stderr; no spinner when not a TTY; honour NO_COLOR",
		mcp: "status {value, tone, reason} and progress notifications for long work",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
	a11y: [
		{
			web: "Polite and assertive live regions, plus a settled status line.",
			cli: "Plain status lines on stderr. No spinner when not a TTY. Honour NO_COLOR.",
			mcp: "status {value, tone, reason}; progress notifications for long work.",
		},
		{
			web: "Tone is a word in the text, not colour alone.",
			cli: "Leading tone word (warning:, error:).",
			mcp: "tone enum plus a human label.",
		},
		{
			web: "aria-busy only on the busy region. Indeterminate progress or a skeleton.",
			cli: "in progress. A second call says already running.",
			mcp: 'status "busy". The second call is idempotent.',
		},
		{
			web: "Each instance has its own region ids.",
			cli: "Instance id in the output.",
			mcp: "instanceId in the result.",
		},
	],
} as const satisfies ComponentContract;
