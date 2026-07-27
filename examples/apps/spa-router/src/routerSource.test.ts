import { describe, expect, it } from "vitest";
import { createMemoryNavigation } from "./navigation";
import { createRouterSource } from "./routerSource";

const flushMicrotasks = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("spa router source", () => {
	it("commits accepted navigation after machine resolution", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		source.send({ type: "NAVIGATE_REQUESTED", to: "/about" });
		await flushMicrotasks();

		expect(source.getSnapshot().context).toMatchObject({
			path: "/about",
			route: "about",
			source: "navigate",
		});
		expect(navigation.commitCalls).toEqual([
			{ path: "/about", history: "push" },
		]);
	});

	it("replaces redirected paths instead of pushing the rejected destination", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		source.send({ type: "NAVIGATE_REQUESTED", to: "/dashboard" });
		await flushMicrotasks();

		expect(source.getSnapshot().context).toMatchObject({
			path: "/login",
			route: "login",
			redirected: true,
		});
		expect(navigation.commitCalls).toEqual([
			{ path: "/login", history: "replace" },
		]);
	});

	it("uses the same source factory for headless external navigation and routerSource.stop cleanup", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		expect(navigation.observerCount()).toBe(1);

		navigation.externalNavigate("/users/7");
		expect(source.getSnapshot().context).toMatchObject({
			path: "/users/7",
			route: "user",
		});

		source.stop();
		expect(navigation.observerCount()).toBe(0);

		navigation.externalNavigate("/about");
		expect(source.getSnapshot().context).toMatchObject({
			path: "/users/7",
			route: "user",
		});
	});

	it("records an explicit failure fact when the accepted navigation commit rejects", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		navigation.rejectNextCommit(new Error("commit rejected"));
		source.send({ type: "NAVIGATE_REQUESTED", to: "/about" });
		await flushMicrotasks();

		expect(source.getSnapshot().context.lastCommitError).toBe(
			"commit rejected",
		);
	});

	it("retries the same accepted navigation after a rejected commit without mutating currentPath", async () => {
		const navigation = createMemoryNavigation("/");
		const source = createRouterSource({ navigation });

		navigation.rejectNextCommit(new Error("commit rejected"));
		source.send({ type: "NAVIGATE_REQUESTED", to: "/about" });
		await flushMicrotasks();

		expect(navigation.currentPath()).toBe("/");
		expect(source.getSnapshot().context.lastCommitError).toBe(
			"commit rejected",
		);

		source.send({ type: "NAVIGATE_REQUESTED", to: "/about" });
		await flushMicrotasks();

		expect(navigation.currentPath()).toBe("/about");
		expect(navigation.commitCalls).toEqual([
			{ path: "/about", history: "push" },
			{ path: "/about", history: "push" },
		]);
		expect(source.getSnapshot().context.lastCommitError).toBeNull();
	});
});
