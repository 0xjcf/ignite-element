import { describe, expect, it } from "vitest";
import { createMemoryNavigation } from "./navigation";
import { createRouterSource } from "./routerSource";

const flushMicrotasks = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("nested child router source", () => {
	it("commits child-route navigation through the source after the machine accepts it", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		source.send({ type: "OPEN_DOC_SECTION", section: "api" });
		await flushMicrotasks();

		expect(source.getSnapshot().context).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
			source: "child",
		});
		expect(navigation.commitCalls).toEqual([
			{ path: "/docs/api", history: "push" },
		]);
	});

	it("replaces canonicalized paths and skips duplicate accepted writes", async () => {
		const navigation = createMemoryNavigation("/docs/api?tab=reference");
		const source = createRouterSource({ navigation });

		source.send({ type: "NAVIGATE_REQUESTED", to: "/docs/api" });
		await flushMicrotasks();
		expect(navigation.commitCalls).toEqual([]);

		source.send({ type: "NAVIGATE_REQUESTED", to: "/settings/" });
		await flushMicrotasks();
		expect(navigation.commitCalls).toEqual([
			{ path: "/settings", history: "replace" },
		]);
	});

	it("observes external navigation and detaches listeners on routerSource.stop()", () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		expect(navigation.observerCount()).toBe(1);

		navigation.externalNavigate("/settings/billing");
		expect(source.getSnapshot().context).toMatchObject({
			parent: "settings",
			child: "billing",
			path: "/settings/billing",
		});

		source.stop();
		expect(navigation.observerCount()).toBe(0);
	});
});
