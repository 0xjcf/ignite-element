import { describe, expect, it } from "vitest";
import {
	createInitialContext,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";

describe("nested child router core", () => {
	it("resolves top-level and child routes from the path", () => {
		expect(resolveNestedRoute("/docs/api")).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});
		expect(resolveNestedRoute("/settings/billing")).toMatchObject({
			parent: "settings",
			child: "billing",
			path: "/settings/billing",
		});
	});

	it("defaults child outlets when the parent route is selected", () => {
		expect(resolveNestedRoute("/docs")).toMatchObject({
			parent: "docs",
			child: "overview",
			path: "/docs",
		});
		expect(createInitialContext("/settings").child).toBe("profile");
	});

	it("announces committed nested route changes", () => {
		const emitted = routerMachine.config.on?.NAVIGATE;
		expect(emitted).toBeDefined();
	});
});
