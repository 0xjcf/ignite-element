import type { GalleryFixture } from "../contract";
import type { LivePoliteness, LiveProgress } from "./live-status.source";

export type LiveStatusFixtureInput = {
	message: string;
	politeness: LivePoliteness;
	busy: boolean;
	progress: LiveProgress;
	settled: string | null;
	tone: string;
	reason: string | null;
};

export const liveStatusGallery: readonly GalleryFixture<LiveStatusFixtureInput>[] =
	[
		{
			id: "quiet",
			state: "quiet",
			title: "Quiet",
			input: {
				message: "",
				politeness: "off",
				busy: false,
				progress: "none",
				settled: null,
				tone: "neutral",
				reason: null,
			},
		},
		{
			id: "devtools-connecting",
			state: "polite",
			title: "Connecting",
			app: "DevTools",
			input: {
				message: "Connecting",
				politeness: "polite",
				busy: false,
				progress: "none",
				settled: null,
				tone: "info",
				reason: null,
			},
		},
		{
			id: "twilight-saving",
			state: "assertive",
			title: "Save failed",
			app: "Twilight",
			input: {
				message: "Could not save.",
				politeness: "assertive",
				busy: false,
				progress: "none",
				settled: null,
				tone: "error",
				reason: "Could not save.",
			},
		},
		{
			id: "devtools-export-busy",
			state: "busy",
			title: "Export in progress",
			app: "DevTools",
			input: {
				message: "Preparing the export.",
				politeness: "polite",
				busy: true,
				progress: "indeterminate",
				settled: null,
				tone: "info",
				reason: null,
			},
		},
		{
			id: "booster-skeleton",
			state: "busy",
			title: "Home loading",
			app: "Booster Budget",
			input: {
				message: "Loading the month.",
				politeness: "polite",
				busy: true,
				progress: "skeleton",
				settled: null,
				tone: "neutral",
				reason: null,
			},
		},
		{
			id: "devtools-exported",
			state: "settled",
			title: "Export settled",
			app: "DevTools",
			input: {
				message: "",
				politeness: "off",
				busy: false,
				progress: "none",
				settled: "Exported",
				tone: "success",
				reason: null,
			},
		},
	];
