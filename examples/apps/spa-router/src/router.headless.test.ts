import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { createMemoryNavigation } from "./navigation";
import { createRouterSource } from "./routerSource";

// The payoff of keeping the router's core pure: you can drive navigation
// through Ignite's headless runtime and assert the result with no DOM, no
// jsdom History, no rendered element. `execute` issues a command, `getStates`
// reads the projection, and `on`/`execute().events` observe the emitted
// `navigated` event (bridged from the machine through the subscribeEvents seam).
const makeRouter = () =>
	igniteCore({
		source: createRouterSource({
			navigation: createMemoryNavigation("/"),
		}),
		states: (snapshot) => ({
			route: snapshot.context.route,
			path: snapshot.context.path,
			id: snapshot.context.params.id ?? null,
			authed: snapshot.context.authed,
		}),
		commands: ({ actor }) => ({
			navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
			login: () => actor.send({ type: "LOGIN" }),
			logout: () => actor.send({ type: "LOGOUT" }),
		}),
	});

describe("SPA router — headless runtime", () => {
	it("navigates and projects the matched route + params", async () => {
		const router = makeRouter();
		await router.execute({ command: "navigate", input: "/users/7" });

		const view = router.getStates();
		expect(view.route).toBe("user");
		expect(view.id).toBe("7");
		expect(view.path).toBe("/users/7");
	});

	it("surfaces the navigated event through on(...)", () => {
		const router = makeRouter();
		const seen: string[] = [];
		router.on("navigated", (event) => {
			seen.push(event.route);
		});

		void router.execute({ command: "navigate", input: "/about" });
		expect(seen).toContain("about");
	});

	it("captures navigated events in execute().events", async () => {
		const router = makeRouter();
		const result = await router.execute({
			command: "navigate",
			input: "/users/3",
		});
		expect(result.events).toContainEqual({
			type: "navigated",
			path: "/users/3",
			route: "user",
		});
	});

	it("enforces the auth guard, then allows the route after login", async () => {
		const router = makeRouter();

		await router.execute({ command: "navigate", input: "/dashboard" });
		expect(router.getStates().route).toBe("login");

		await router.execute({ command: "login" });
		await router.execute({ command: "navigate", input: "/dashboard" });
		expect(router.getStates().route).toBe("dashboard");
		expect(router.getStates().authed).toBe(true);
	});

	it("resolves unknown paths to the not-found route", async () => {
		const router = makeRouter();
		await router.execute({ command: "navigate", input: "/no/such/page" });
		expect(router.getStates().route).toBe("not-found");
	});
});
