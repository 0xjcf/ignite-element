import type { GalleryFixture } from "../contract";

export type ExportButtonFixtureInput = {
	label: string;
	pendingLabel: string;
	readyLabel: string;
	format: string;
	phase: "idle" | "preparing" | "ready" | "failed";
	reason: string | null;
};

export const exportButtonGallery: readonly GalleryFixture<ExportButtonFixtureInput>[] =
	[
		{
			id: "devtools-idle",
			state: "idle",
			title: "Export the event log",
			app: "DevTools",
			input: {
				label: "Export JSON",
				pendingLabel: "Preparing…",
				readyLabel: "Exported",
				format: "json",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "devtools-preparing",
			state: "preparing",
			title: "Preparing the event log",
			app: "DevTools",
			input: {
				label: "Export JSON",
				pendingLabel: "Preparing…",
				readyLabel: "Exported",
				format: "json",
				phase: "preparing",
				reason: null,
			},
		},
		{
			id: "devtools-ready",
			state: "ready",
			title: "Event log exported",
			app: "DevTools",
			input: {
				label: "Export JSON",
				pendingLabel: "Preparing…",
				readyLabel: "Exported",
				format: "json",
				phase: "ready",
				reason: null,
			},
		},
		{
			id: "devtools-failed",
			state: "failed",
			title: "Event log failed",
			app: "DevTools",
			input: {
				label: "Export JSON",
				pendingLabel: "Preparing…",
				readyLabel: "Exported",
				format: "json",
				phase: "failed",
				reason: "Could not write the file.",
			},
		},
		{
			id: "booster-idle",
			state: "idle",
			title: "Export my data",
			app: "Booster Budget",
			input: {
				label: "Export my data",
				pendingLabel: "Preparing…",
				readyLabel: "Download ready",
				format: "json",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "booster-failed",
			state: "failed",
			title: "Data export failed",
			app: "Booster Budget",
			input: {
				label: "Export my data",
				pendingLabel: "Preparing…",
				readyLabel: "Download ready",
				format: "json",
				phase: "failed",
				reason: "The export was stopped.",
			},
		},
	];
