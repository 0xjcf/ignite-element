import type { GalleryFixture } from "../contract";
import type { StatusPillTone } from "./status-pill.source";

export type StatusPillFixtureInput = {
	value: string;
	tone: StatusPillTone;
	reason: string | null;
};

export const statusPillGallery: readonly GalleryFixture<StatusPillFixtureInput>[] =
	[
		{
			id: "label",
			state: "plain",
			title: "Label",
			input: { value: "Saved", tone: "neutral", reason: null },
		},
		{
			id: "label-with-reason",
			state: "withReason",
			title: "Label with reason",
			input: {
				value: "Paused",
				tone: "warning",
				reason: "Inspection is paused.",
			},
		},
		{
			id: "devtools-disconnected",
			state: "withReason",
			title: "Disconnected",
			app: "DevTools",
			input: {
				value: "Disconnected",
				tone: "warning",
				reason: "No runtime is attached.",
			},
		},
		{
			id: "devtools-connecting",
			state: "plain",
			title: "Connecting",
			app: "DevTools",
			input: { value: "Connecting", tone: "info", reason: null },
		},
		{
			id: "devtools-live",
			state: "plain",
			title: "Live",
			app: "DevTools",
			input: { value: "Live", tone: "success", reason: null },
		},
		{
			id: "devtools-paused",
			state: "withReason",
			title: "Paused",
			app: "DevTools",
			input: {
				value: "Paused",
				tone: "warning",
				reason: "Inspection is paused.",
			},
		},
		{
			id: "devtools-error",
			state: "withReason",
			title: "Connection error",
			app: "DevTools",
			input: {
				value: "Error",
				tone: "danger",
				reason: "The runtime did not answer.",
			},
		},
		{
			id: "devtools-surface-web",
			state: "plain",
			title: "Surface web",
			app: "DevTools",
			input: { value: "web", tone: "neutral", reason: null },
		},
		{
			id: "devtools-surface-pwa",
			state: "plain",
			title: "Surface pwa",
			app: "DevTools",
			input: { value: "pwa", tone: "neutral", reason: null },
		},
		{
			id: "devtools-surface-cli",
			state: "plain",
			title: "Surface cli",
			app: "DevTools",
			input: { value: "cli", tone: "neutral", reason: null },
		},
		{
			id: "devtools-surface-mcp",
			state: "plain",
			title: "Surface mcp",
			app: "DevTools",
			input: { value: "mcp", tone: "neutral", reason: null },
		},
		{
			id: "devtools-surface-workbench",
			state: "plain",
			title: "Surface workbench",
			app: "DevTools",
			input: { value: "workbench", tone: "neutral", reason: null },
		},
		{
			id: "devtools-finding-logic",
			state: "plain",
			title: "Finding LOGIC",
			app: "DevTools",
			input: { value: "LOGIC", tone: "danger", reason: null },
		},
		{
			id: "devtools-finding-blocked",
			state: "withReason",
			title: "Finding BLOCKED",
			app: "DevTools",
			input: {
				value: "BLOCKED",
				tone: "warning",
				reason: "A guard refused the command.",
			},
		},
		{
			id: "devtools-finding-skew",
			state: "withReason",
			title: "Finding SKEW",
			app: "DevTools",
			input: {
				value: "SKEW",
				tone: "warning",
				reason: "The surfaces disagree.",
			},
		},
		{
			id: "devtools-finding-pending",
			state: "plain",
			title: "Finding PENDING",
			app: "DevTools",
			input: { value: "PENDING", tone: "info", reason: null },
		},
		{
			id: "twilight-saved",
			state: "plain",
			title: "Saved",
			app: "Twilight",
			input: { value: "Saved", tone: "neutral", reason: null },
		},
		{
			id: "twilight-in-today",
			state: "plain",
			title: "In Today",
			app: "Twilight",
			input: { value: "In Today", tone: "info", reason: null },
		},
		{
			id: "twilight-done",
			state: "plain",
			title: "Done",
			app: "Twilight",
			input: { value: "Done", tone: "success", reason: null },
		},
		{
			id: "booster-period",
			state: "plain",
			title: "Period chip",
			app: "Booster Budget",
			input: { value: "This month", tone: "neutral", reason: null },
		},
		{
			id: "booster-reviewed",
			state: "withReason",
			title: "Reviewed input",
			app: "Booster Budget",
			input: {
				value: "Reviewed",
				tone: "info",
				reason: "This is not a saved effect.",
			},
		},
		{
			id: "booster-preview",
			state: "withReason",
			title: "Preview",
			app: "Booster Budget",
			input: {
				value: "Preview",
				tone: "warning",
				reason: "Nothing has been saved.",
			},
		},
	];
