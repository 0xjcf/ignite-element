import { igniteCore } from "ignite-element/xstate";
import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { dashboardMachine, getDashboardSummary } from "./dashboardModel";

const createSharedDashboard = () => createActor(dashboardMachine).start();

const makeFiltersRuntime = (actor: ReturnType<typeof createSharedDashboard>) =>
	igniteCore({
		source: actor,
		view: ({ snapshot }) => ({
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
		view: ({ snapshot }) => ({
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

		await filters.execute("selectTeam", "ops");
		await filters.execute("selectRange", "day");

		expect(summary.getView()).toMatchObject({
			team: "ops",
			range: "day",
			summary: { openTickets: 17, slaRisk: 2 },
		});

		actor.stop();
	});

	it("captures dashboard events from shared state commands", async () => {
		const actor = createSharedDashboard();
		const summary = makeSummaryRuntime(actor);

		const result = await summary.execute("dismissAlert", "latency");

		expect(result.events).toContainEqual({
			type: "alertDismissed",
			payload: { type: "alertDismissed", id: "latency" },
		});

		actor.stop();
	});
});
