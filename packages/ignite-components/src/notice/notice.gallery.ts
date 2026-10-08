import type { GalleryFixture } from "../contract";
import type { NoticeTone } from "./notice.source";

export type NoticeFixtureInput = {
	tone: NoticeTone;
	message: string;
	actions: readonly string[];
	dismissible: boolean;
	dismissed: boolean;
};

export const noticeGallery: readonly GalleryFixture<NoticeFixtureInput>[] = [
	{
		id: "reconnect",
		state: "shown",
		title: "Reconnect",
		app: "DevTools",
		input: {
			tone: "warning",
			message: "Reconnect to the page.",
			actions: ["Reconnect"],
			dismissible: false,
			dismissed: false,
		},
	},
	{
		id: "stale-inspector",
		state: "shown",
		title: "Stale inspector",
		app: "DevTools",
		input: {
			tone: "stale",
			message: "This inspector is showing the last snapshot.",
			actions: [],
			dismissible: true,
			dismissed: false,
		},
	},
	{
		id: "log-failed",
		state: "shown",
		title: "Log failed",
		app: "DevTools",
		input: {
			tone: "error",
			message: "The event log failed to load.",
			actions: ["Retry"],
			dismissible: false,
			dismissed: false,
		},
	},
	{
		id: "which-friday",
		state: "shown",
		title: "Which Friday",
		app: "Twilight",
		input: {
			tone: "warning",
			message: "Which Friday?",
			actions: ["This Friday", "Next Friday"],
			dismissible: true,
			dismissed: false,
		},
	},
	{
		id: "empty-thought",
		state: "shown",
		title: "Empty thought",
		app: "Twilight",
		input: {
			tone: "error",
			message: "Write the thought before saving it.",
			actions: [],
			dismissible: false,
			dismissed: false,
		},
	},
	{
		id: "suggestions-off",
		state: "shown",
		title: "Suggestions unavailable",
		app: "Twilight",
		input: {
			tone: "info",
			message: "Suggestions are unavailable.",
			actions: [],
			dismissible: true,
			dismissed: false,
		},
	},
	{
		id: "stale-forecast",
		state: "shown",
		title: "Last known data",
		app: "Booster Budget",
		input: {
			tone: "stale",
			message: "This forecast is from the last known data.",
			actions: ["Refresh"],
			dismissible: false,
			dismissed: false,
		},
	},
	{
		id: "ai-off",
		state: "shown",
		title: "AI off",
		app: "Booster Budget",
		input: {
			tone: "ai-off",
			message: "AI is off. You can still edit this by hand.",
			actions: ["Edit by hand"],
			dismissible: true,
			dismissed: false,
		},
	},
	{
		id: "dismissed-income",
		state: "dismissed",
		title: "Dismissed income notice",
		app: "Booster Budget",
		input: {
			tone: "warning",
			message: "Income this month is uncertain.",
			actions: [],
			dismissible: true,
			dismissed: true,
		},
	},
];
