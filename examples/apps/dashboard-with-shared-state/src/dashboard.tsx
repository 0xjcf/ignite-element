import { igniteCore } from "ignite-element/xstate";
import styles from "./dashboard.css?raw";
import {
	getDashboardSummary,
	getVisibleAlerts,
	type Range,
	type Team,
} from "./dashboardModel";
import { dashboardActor } from "./dashboardStore";

const teams: Array<{ value: Team; label: string }> = [
	{ value: "support", label: "Support" },
	{ value: "ops", label: "Ops" },
	{ value: "success", label: "Success" },
];

const ranges: Array<{ value: Range; label: string }> = [
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
];

const defineDashboardWidget = igniteCore({
	source: dashboardActor,
	states: (snapshot) => ({
		team: snapshot.context.team,
		range: snapshot.context.range,
		summary: getDashboardSummary(snapshot.context.team, snapshot.context.range),
		alerts: getVisibleAlerts(snapshot.context.dismissedAlertIds),
		dismissedCount: snapshot.context.dismissedAlertIds.length,
	}),
	commands: ({ actor }) => ({
		selectTeam: (team: Team) => actor.send({ type: "SELECT_TEAM", team }),
		selectRange: (range: Range) => actor.send({ type: "SELECT_RANGE", range }),
		dismissAlert: (id: string) => actor.send({ type: "DISMISS_ALERT", id }),
		reset: () => actor.send({ type: "RESET" }),
	}),
});

defineDashboardWidget("dashboard-app", (ctx) => (
	<div class="dashboard">
		<style>{styles}</style>
		<header class="header">
			<div>
				<span class="eyebrow">Shared-state dashboard</span>
				<h1>Operations workspace</h1>
				<p class="muted">
					Every widget below projects the same actor. Filters change summary
					cards and alert state without prop drilling.
				</p>
			</div>
			<button type="button" onClick={() => ctx.reset()}>
				Reset
			</button>
		</header>
		<section class="layout">
			<dashboard-filters />
			<div class="controls">
				<metric-summary />
				<alert-feed />
			</div>
		</section>
	</div>
));

defineDashboardWidget("dashboard-filters", (ctx) => (
	<aside class="panel controls" aria-label="Dashboard filters">
		<style>{styles}</style>
		<div class="control-group">
			<h2>Team</h2>
			<div class="button-row">
				{teams.map((team) => (
					<button
						type="button"
						class={ctx.team === team.value ? "is-active" : undefined}
						aria-pressed={ctx.team === team.value ? "true" : "false"}
						onClick={() => ctx.selectTeam(team.value)}
					>
						{team.label}
					</button>
				))}
			</div>
		</div>
		<div class="control-group">
			<h2>Range</h2>
			<div class="button-row">
				{ranges.map((range) => (
					<button
						type="button"
						class={ctx.range === range.value ? "is-active" : undefined}
						aria-pressed={ctx.range === range.value ? "true" : "false"}
						onClick={() => ctx.selectRange(range.value)}
					>
						{range.label}
					</button>
				))}
			</div>
		</div>
	</aside>
));

defineDashboardWidget("metric-summary", (ctx) => (
	<section class="panel" aria-labelledby="metric-summary-title">
		<style>{styles}</style>
		<h2 id="metric-summary-title">Metrics</h2>
		<div class="metric-grid">
			<article class="metric">
				<span>Open tickets</span>
				<strong>{ctx.summary.openTickets}</strong>
			</article>
			<article class="metric">
				<span>SLA risk</span>
				<strong>{ctx.summary.slaRisk}</strong>
			</article>
			<article class="metric">
				<span>Throughput</span>
				<strong>{ctx.summary.throughput}</strong>
			</article>
		</div>
	</section>
));

defineDashboardWidget("alert-feed", (ctx) => (
	<section class="panel" aria-labelledby="alert-feed-title">
		<style>{styles}</style>
		<h2 id="alert-feed-title">Alerts</h2>
		<p class="muted">Dismissed alerts: {ctx.dismissedCount}</p>
		<ul class="alerts">
			{ctx.alerts.map((alert) => (
				<li class="alert" data-severity={alert.severity}>
					<div>
						<strong>{alert.title}</strong>
						<div class="muted">
							{alert.team} / {alert.severity}
						</div>
					</div>
					<button
						type="button"
						aria-label={`Dismiss ${alert.title}`}
						onClick={() => ctx.dismissAlert(alert.id)}
					>
						Dismiss
					</button>
				</li>
			))}
		</ul>
	</section>
));
