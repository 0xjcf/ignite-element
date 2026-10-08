import type { GalleryFixture } from "../contract";

export type AppShellFixtureInput = {
	activeRoute: string;
	menuOpen: boolean;
	returnTo: string | null;
	panelOpen: boolean;
};

export const appShellGallery: readonly GalleryFixture<AppShellFixtureInput>[] =
	[
		{
			id: "closed",
			state: "closed",
			title: "Menu closed",
			input: {
				activeRoute: "Inspector",
				menuOpen: false,
				returnTo: null,
				panelOpen: false,
			},
		},
		{
			id: "open",
			state: "open",
			title: "Menu open",
			input: {
				activeRoute: "Log",
				menuOpen: true,
				returnTo: null,
				panelOpen: false,
			},
		},
		{
			id: "devtools-dock",
			state: "open",
			title: "Dock frame",
			app: "DevTools",
			input: {
				activeRoute: "Inspector",
				menuOpen: true,
				returnTo: null,
				panelOpen: true,
			},
		},
		{
			id: "twilight-rail",
			state: "open",
			title: "Workspace rail",
			app: "Twilight",
			input: {
				activeRoute: "Today",
				menuOpen: true,
				returnTo: "Capture",
				panelOpen: true,
			},
		},
		{
			id: "twilight-return",
			state: "closed",
			title: "Return to capture",
			app: "Twilight",
			input: {
				activeRoute: "Today",
				menuOpen: false,
				returnTo: "Capture",
				panelOpen: false,
			},
		},
		{
			id: "booster-sidebar",
			state: "open",
			title: "Sidebar",
			app: "Booster Budget",
			input: {
				activeRoute: "Calendar",
				menuOpen: true,
				returnTo: null,
				panelOpen: false,
			},
		},
		{
			id: "booster-mobile",
			state: "open",
			title: "Mobile menu",
			app: "Booster Budget",
			input: {
				activeRoute: "Home",
				menuOpen: true,
				returnTo: "Calendar",
				panelOpen: false,
			},
		},
	];
