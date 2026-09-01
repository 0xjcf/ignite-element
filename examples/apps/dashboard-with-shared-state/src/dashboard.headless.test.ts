import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { dashboardMachine, getDashboardSummary } from "./dashboardModel";

const createSharedDashboard = () => createActor(dashboardMachine).start();

const makeFiltersRuntime = (actor: ReturnType<typeof createSharedDashboard>) =>
	igniteCore({
		source: actor,
		states: (snapshot) => ({
			team: snapshot.context.team,
			range: snapshot.context.range,
		}),
		commands: ({ actor }) => ({
			selectTeam: (team: "support" | "ops" | "success") =>
				actor.send({ type: "SELECT_TEAM", team }),
			selectRange: (range: "day" | "week") =>
				actor.send({ type: "SELECT_RANGE", range }),
		}),
	});

const makeSummaryRuntime = (actor: ReturnType<typeof createSharedDashboard>) =>
	igniteCore({
		source: actor,
		states: (snapshot) => ({
			team: snapshot.context.team,
			range: snapshot.context.range,
			summary: getDashboardSummary(
				snapshot.context.team,
				snapshot.context.range,
			),
		}),
		commands: ({ actor }) => ({
			dismissAlert: (id: string) => actor.send({ type: "DISMISS_ALERT", id }),
		}),
	});

describe("dashboard shared state — headless runtime", () => {
	it("updates every widget projection through one shared actor", async () => {
		const actor = createSharedDashboard();
		const filters = makeFiltersRuntime(actor);
		const summary = makeSummaryRuntime(actor);

		await filters.execute({ command: "selectTeam", input: "ops" });
		await filters.execute({ command: "selectRange", input: "day" });

		expect(summary.getStates()).toMatchObject({
			team: "ops",
			range: "day",
			summary: { openTickets: 17, slaRisk: 2 },
		});

		actor.stop();
	});

	it("captures dashboard events from shared state commands", async () => {
		const actor = createSharedDashboard();
		const summary = makeSummaryRuntime(actor);

		const result = await summary.execute({
			command: "dismissAlert",
			input: "latency",
		});

		expect(result.events).toContainEqual({
			type: "alertDismissed",
			id: "latency",
		});

		actor.stop();
	});

	it("does not emit dismissal events for already dismissed alerts", async () => {
		const actor = createSharedDashboard();
		const summary = makeSummaryRuntime(actor);

		await summary.execute({ command: "dismissAlert", input: "latency" });
		const result = await summary.execute({
			command: "dismissAlert",
			input: "latency",
		});

		expect(result.events).not.toContainEqual({
			type: "alertDismissed",
			id: "latency",
		});

		actor.stop();
	});
});
