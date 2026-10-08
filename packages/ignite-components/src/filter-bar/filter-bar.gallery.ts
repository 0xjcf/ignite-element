import type { GalleryFixture } from "../contract";

export type FilterBarFixtureInput = {
	label: string;
	query: string;
	filters: string;
	active: string;
};

export const filterBarGallery: readonly GalleryFixture<FilterBarFixtureInput>[] =
	[
		{
			id: "devtools-idle",
			state: "idle",
			title: "Event log, nothing narrowed",
			app: "DevTools",
			input: {
				label: "Filter the event log",
				query: "",
				filters: "Type\nSurface\nRuntime",
				active: "",
			},
		},
		{
			id: "devtools-query",
			state: "filtered",
			title: "Event log text",
			app: "DevTools",
			input: {
				label: "Filter the event log",
				query: "connect",
				filters: "Type\nSurface\nRuntime",
				active: "",
			},
		},
		{
			id: "devtools-chips",
			state: "filtered",
			title: "Type and surface",
			app: "DevTools",
			input: {
				label: "Filter the event log",
				query: "",
				filters: "Type\nSurface\nRuntime",
				active: "Type\nSurface",
			},
		},
		{
			id: "booster-idle",
			state: "idle",
			title: "Bills, nothing narrowed",
			app: "Booster Budget",
			input: {
				label: "Filter bills",
				query: "",
				filters: "Status\nThis month",
				active: "",
			},
		},
		{
			id: "booster-status",
			state: "filtered",
			title: "Unpaid this month",
			app: "Booster Budget",
			input: {
				label: "Filter bills",
				query: "rent",
				filters: "Status\nThis month",
				active: "Status\nThis month",
			},
		},
	];
