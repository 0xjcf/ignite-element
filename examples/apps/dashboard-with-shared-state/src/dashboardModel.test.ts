import { describe, expect, it } from "vitest";
import {
	dashboardMachine,
	getDashboardSummary,
	getVisibleAlerts,
} from "./dashboardModel";

describe("dashboard shared-state core", () => {
	it("derives summary metrics from the selected team and range", () => {
		expect(getDashboardSummary("support", "week")).toMatchObject({
			openTickets: 42,
			slaRisk: 5,
			throughput: 128,
		});
		expect(getDashboardSummary("ops", "day").openTickets).toBeLessThan(42);
	});

	it("filters visible alerts after dismissal", () => {
		expect(getVisibleAlerts(["latency"])).not.toContainEqual(
			expect.objectContaining({ id: "latency" }),
		);
	});

	it("declares shared dashboard intent events", () => {
		expect(dashboardMachine.config.on?.SELECT_TEAM).toBeDefined();
		expect(dashboardMachine.config.on?.DISMISS_ALERT).toBeDefined();
	});
});
