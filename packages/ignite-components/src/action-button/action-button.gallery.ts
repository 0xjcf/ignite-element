import type { GalleryFixture } from "../contract";
import type { ActionButtonPhase } from "./action-button.source";

export type ActionButtonFixtureInput = {
	label: string;
	pendingLabel: string;
	phase: ActionButtonPhase;
	reason: string | null;
};

export const actionButtonGallery: readonly GalleryFixture<ActionButtonFixtureInput>[] =
	[
		{
			id: "idle",
			state: "idle",
			title: "Ready",
			input: {
				label: "Save",
				pendingLabel: "Saving…",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "pending",
			state: "pending",
			title: "Pending",
			input: {
				label: "Save",
				pendingLabel: "Saving…",
				phase: "pending",
				reason: null,
			},
		},
		{
			id: "unavailable",
			state: "unavailable",
			title: "Unavailable",
			input: {
				label: "Save",
				pendingLabel: "Saving…",
				phase: "unavailable",
				reason: "Today is full (3/3).",
			},
		},
		{
			id: "devtools-pause",
			state: "idle",
			title: "Pause",
			app: "DevTools",
			input: {
				label: "Pause",
				pendingLabel: "Pausing…",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "devtools-guard-off",
			state: "unavailable",
			title: "Guard off",
			app: "DevTools",
			input: {
				label: "Clear",
				pendingLabel: "Clearing…",
				phase: "unavailable",
				reason: "The guard is off.",
			},
		},
		{
			id: "twilight-save",
			state: "idle",
			title: "Save the task",
			app: "Twilight",
			input: {
				label: "Save Pay rent",
				pendingLabel: "Saving…",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "twilight-saving",
			state: "pending",
			title: "Saving",
			app: "Twilight",
			input: {
				label: "Save Pay rent",
				pendingLabel: "Saving…",
				phase: "pending",
				reason: null,
			},
		},
		{
			id: "twilight-today-full",
			state: "unavailable",
			title: "Add to Today",
			app: "Twilight",
			input: {
				label: "Add to Today",
				pendingLabel: "Adding…",
				phase: "unavailable",
				reason: "Today is full (3/3).",
			},
		},
		{
			id: "twilight-start",
			state: "pending",
			title: "Start 5 minutes",
			app: "Twilight",
			input: {
				label: "Start 5 minutes",
				pendingLabel: "Starting…",
				phase: "pending",
				reason: null,
			},
		},
		{
			id: "twilight-done",
			state: "idle",
			title: "Done, with the finish line",
			app: "Twilight",
			input: {
				label: "Done: the sink is empty",
				pendingLabel: "Finishing…",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "booster-apply",
			state: "idle",
			title: "Apply",
			app: "Booster Budget",
			input: {
				label: "Apply",
				pendingLabel: "Applying…",
				phase: "idle",
				reason: null,
			},
		},
		{
			id: "booster-apply-blocked",
			state: "unavailable",
			title: "Apply needs an amount",
			app: "Booster Budget",
			input: {
				label: "Apply",
				pendingLabel: "Applying…",
				phase: "unavailable",
				reason: "Enter an amount first.",
			},
		},
	];
