import type { GalleryFixture } from "../contract";
import type { EmptyStateKind } from "./empty-state.source";

export type EmptyStateFixtureInput = {
	kind: EmptyStateKind;
	title: string;
	message: string;
	actionLabel: string | null;
};

export const emptyStateGallery: readonly GalleryFixture<EmptyStateFixtureInput>[] =
	[
		{
			id: "no-runtime",
			state: "empty",
			title: "No runtime",
			app: "DevTools",
			input: {
				kind: "empty",
				title: "No runtime attached",
				message: "Connect a page to inspect it.",
				actionLabel: null,
			},
		},
		{
			id: "empty-log",
			state: "empty",
			title: "Empty log",
			app: "DevTools",
			input: {
				kind: "empty",
				title: "No events yet",
				message: "Events show up here after the runtime sends them.",
				actionLabel: null,
			},
		},
		{
			id: "no-match",
			state: "filtered",
			title: "No match",
			app: "DevTools",
			input: {
				kind: "filtered",
				title: "Nothing matches this filter",
				message: "Clear the filter to see the rest of the log.",
				actionLabel: "Clear filters",
			},
		},
		{
			id: "today-empty",
			state: "empty",
			title: "Empty today",
			app: "Twilight",
			input: {
				kind: "empty",
				title: "Today is empty",
				message: "Capacity 0/3.",
				actionLabel: "Add a thought",
			},
		},
		{
			id: "capture-empty",
			state: "empty",
			title: "Empty capture",
			app: "Twilight",
			input: {
				kind: "empty",
				title: "Nothing captured",
				message: "A thought you save shows up here.",
				actionLabel: "Capture a thought",
			},
		},
		{
			id: "no-activity",
			state: "empty",
			title: "No activity",
			app: "Booster Budget",
			input: {
				kind: "empty",
				title: "No activity",
				message: "Nothing is recorded in this list.",
				actionLabel: null,
			},
		},
		{
			id: "outside-horizon",
			state: "outside-range",
			title: "Outside the horizon",
			app: "Booster Budget",
			input: {
				kind: "outside-range",
				title: "Outside this range",
				message: "This date is outside the calendar horizon.",
				actionLabel: "Jump to this month",
			},
		},
	];
