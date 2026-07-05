import { assign, emit, setup } from "xstate";

export type Team = "support" | "ops" | "success";
export type Range = "day" | "week";

export type DashboardSummary = {
	openTickets: number;
	slaRisk: number;
	throughput: number;
};

export type DashboardAlert = {
	id: string;
	title: string;
	team: Team;
	severity: "medium" | "high";
};

export type DashboardContext = {
	team: Team;
	range: Range;
	dismissedAlertIds: string[];
};

export type DashboardEvent =
	| { type: "SELECT_TEAM"; team: Team }
	| { type: "SELECT_RANGE"; range: Range }
	| { type: "DISMISS_ALERT"; id: string }
	| { type: "RESET" };

export type DashboardEmitted = {
	type: "alertDismissed";
	id: string;
};

const summaryByTeam: Record<Team, Record<Range, DashboardSummary>> = {
	support: {
		day: { openTickets: 19, slaRisk: 3, throughput: 31 },
		week: { openTickets: 42, slaRisk: 5, throughput: 128 },
	},
	ops: {
		day: { openTickets: 17, slaRisk: 2, throughput: 44 },
		week: { openTickets: 38, slaRisk: 4, throughput: 174 },
	},
	success: {
		day: { openTickets: 9, slaRisk: 1, throughput: 28 },
		week: { openTickets: 24, slaRisk: 2, throughput: 112 },
	},
};

const alerts: DashboardAlert[] = [
	{
		id: "latency",
		title: "API latency above target for enterprise accounts",
		team: "ops",
		severity: "high",
	},
	{
		id: "renewal-risk",
		title: "Renewal risk needs success follow-up",
		team: "success",
		severity: "medium",
	},
	{
		id: "ticket-surge",
		title: "Ticket queue is trending above weekly baseline",
		team: "support",
		severity: "medium",
	},
];

export const getDashboardSummary = (
	team: Team,
	range: Range,
): DashboardSummary => summaryByTeam[team][range];

export const getVisibleAlerts = (
	dismissedAlertIds: string[],
): DashboardAlert[] =>
	alerts.filter((alert) => !dismissedAlertIds.includes(alert.id));

export const dashboardMachine = setup({
	types: {
		context: {} as DashboardContext,
		events: {} as DashboardEvent,
		emitted: {} as DashboardEmitted,
	},
	actions: {
		selectTeam: assign(({ event }) =>
			event.type === "SELECT_TEAM" ? { team: event.team } : {},
		),
		selectRange: assign(({ event }) =>
			event.type === "SELECT_RANGE" ? { range: event.range } : {},
		),
		dismissAlert: assign(({ context, event }) => {
			if (
				event.type !== "DISMISS_ALERT" ||
				context.dismissedAlertIds.includes(event.id)
			) {
				return {};
			}
			return {
				dismissedAlertIds: [...context.dismissedAlertIds, event.id],
			};
		}),
		announceDismissal: emit(({ event }) => ({
			type: "alertDismissed" as const,
			id: event.type === "DISMISS_ALERT" ? event.id : "",
		})),
		reset: assign({
			team: "support" as const,
			range: "week" as const,
			dismissedAlertIds: [] as string[],
		}),
	},
}).createMachine({
	context: {
		team: "support",
		range: "week",
		dismissedAlertIds: [],
	},
	on: {
		SELECT_TEAM: { actions: "selectTeam" },
		SELECT_RANGE: { actions: "selectRange" },
		DISMISS_ALERT: { actions: ["dismissAlert", "announceDismissal"] },
		RESET: { actions: "reset" },
	},
});
