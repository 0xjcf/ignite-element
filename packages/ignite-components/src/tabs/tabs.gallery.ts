import type { GalleryFixture } from "../contract";

export type TabsFixtureInput = {
	label: string;
	items: string;
	active: string | null;
};

export const tabsGallery: readonly GalleryFixture<TabsFixtureInput>[] = [
	{
		id: "devtools-panels",
		state: "selected",
		title: "Contract, Gallery, Controls",
		app: "DevTools",
		input: {
			label: "DevTools panels",
			items: "Contract\nGallery\nControls",
			active: "Gallery",
		},
	},
	{
		id: "devtools-switcher",
		state: "selected",
		title: "Panel switcher",
		app: "DevTools",
		input: {
			label: "Panel",
			items: "Inspector\nLog\nWorkbench",
			active: "Inspector",
		},
	},
	{
		id: "devtools-none",
		state: "open",
		title: "Nothing selected yet",
		app: "DevTools",
		input: {
			label: "Panel",
			items: "Inspector\nLog",
			active: null,
		},
	},
	{
		id: "devtools-empty",
		state: "empty",
		title: "No panels",
		app: "DevTools",
		input: {
			label: "Panel",
			items: "",
			active: null,
		},
	},
	{
		id: "booster-period",
		state: "selected",
		title: "Calendar period",
		app: "Booster Budget",
		input: {
			label: "Period",
			items: "Month\nTwo weeks\nWeek",
			active: "Two weeks",
		},
	},
	{
		id: "booster-agenda",
		state: "selected",
		title: "Calendar or agenda",
		app: "Booster Budget",
		input: {
			label: "View",
			items: "Calendar\nAgenda",
			active: "Agenda",
		},
	},
];
