import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { routerMachine } from "./routerMachine";

// The payoff of keeping the router's core pure: you can drive navigation
// through Ignite's headless runtime and assert the result with no DOM, no
// jsdom History, no rendered element. `execute` issues a command, `getView`
// reads the projection, and `on`/`execute().events` observe the emitted
// `navigated` event (bridged from the machine through the subscribeEvents seam).
const makeRouter = () =>
	igniteCore({
		source: routerMachine,
		view: ({ snapshot }) => ({
			route: snapshot.context.route,
			path: snapshot.context.path,
			id: snapshot.context.params.id ?? null,
			authed: snapshot.context.authed,
		}),
		commands: ({ actor }) => ({
			navigate: (to: string) => actor.send({ type: "NAVIGATE", to }),
			login: () => actor.send({ type: "LOGIN" }),
			logout: () => actor.send({ type: "LOGOUT" }),
		}),
	});

describe("SPA router — headless runtime", () => {
	it("navigates and projects the matched route + params", async () => {
		const router = makeRouter();
		await router.execute("navigate", "/users/7");

		const view = router.getView();
		expect(view.route).toBe("user");
		expect(view.id).toBe("7");
		expect(view.path).toBe("/users/7");
	});

	it("surfaces the navigated event through on(...)", () => {
		const router = makeRouter();
		const seen: string[] = [];
		router.on("navigated", (event) => {
			seen.push((event.detail as { route: string }).route);
		});

		void router.execute("navigate", "/about");
		expect(seen).toContain("about");
	});

	it("captures navigated events in execute().events", async () => {
		const router = makeRouter();
		const result = await router.execute("navigate", "/users/3");
		expect(result.events).toContainEqual({
			type: "navigated",
			payload: { type: "navigated", path: "/users/3", route: "user" },
		});
	});

	it("enforces the auth guard, then allows the route after login", async () => {
		const router = makeRouter();

		await router.execute("navigate", "/dashboard");
		expect(router.getView().route).toBe("login");

		await router.execute("login");
		await router.execute("navigate", "/dashboard");
		expect(router.getView().route).toBe("dashboard");
		expect(router.getView().authed).toBe(true);
	});

	it("resolves unknown paths to the not-found route", async () => {
		const router = makeRouter();
		await router.execute("navigate", "/no/such/page");
		expect(router.getView().route).toBe("not-found");
	});
});
