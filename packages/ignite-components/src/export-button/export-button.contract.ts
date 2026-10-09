import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Ask the host to download a file. JSON is the first format.
 * The button does not write the file. preparing, ready, and failed stay honest.
 */
export const exportButtonContract = {
	name: "ExportButton",
	states: ["idle", "preparing", "ready", "failed"],
	flags: [
		{
			name: "canExport",
			kind: "can",
			reasonField: "canExportRefusal",
			reason: "This export is already running.",
		},
		{
			name: "isPreparing",
			kind: "is",
			reasonField: "isPreparingRefusal",
			reason: "This export is not running.",
		},
		{
			name: "isReady",
			kind: "is",
			reasonField: "isReadyRefusal",
			reason: "This export is not ready.",
		},
		{
			name: "isFailed",
			kind: "is",
			reasonField: "isFailedRefusal",
			reason: "This export has not failed.",
		},
		{
			name: "showReason",
			kind: "show",
			reasonField: "showReasonRefusal",
			reason: "No reason was given.",
		},
	],
	commands: [
		{ name: "export", kind: "action", flag: "canExport" },
		{ name: "succeed", kind: "configuration" },
		{ name: "fail", kind: "configuration" },
		{ name: "reset", kind: "configuration" },
		{ name: "setLabel", kind: "configuration", attribute: "label" },
		{
			name: "setPendinglabel",
			kind: "configuration",
			attribute: "pendinglabel",
		},
		{ name: "setReadyLabel", kind: "configuration" },
		{ name: "setReadylabel", kind: "configuration", attribute: "readylabel" },
		{ name: "setFormat", kind: "configuration", attribute: "format" },
	],
	events: ["export"],
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
		cli: "writes a file and returns an exit code",
		mcp: "returns structured content",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
	a11y: [
		{
			web: "LiveStatus announces busy, ready, and failed.",
			cli: "in progress, then a settled line or an error line. No spinner. Honour NO_COLOR.",
			mcp: "status {value, tone, reason}; progress while the export runs.",
		},
		{
			web: "aria-disabled plus a visible reason while the export is unavailable.",
			cli: "Non-zero exit plus a reason line.",
			mcp: "isError plus reason.",
		},
		{
			web: "aria-busy only on the busy region.",
			cli: "in progress. A second call says already running.",
			mcp: 'status "busy". The second call is idempotent.',
		},
		{
			web: "The button label follows setFormat.",
			cli: "The command names the format.",
			mcp: "tone label names the format.",
		},
	],
} as const satisfies ComponentContract;
