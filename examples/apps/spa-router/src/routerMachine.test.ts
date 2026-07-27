import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
	createInitialContext,
	resolveNavigation,
	routerMachine,
} from "./routerMachine";

describe("routerMachine", () => {
	it("starts on the route matched from the initial path", () => {
		const actor = createActor(routerMachine, {
			input: { path: "/about" },
		}).start();
		expect(actor.getSnapshot().context.route).toBe("about");
		expect(actor.getSnapshot().context.source).toBe("init");
	});

	it("navigates to a dynamic route and captures params", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/users/42" });
		const { context } = actor.getSnapshot();
		expect(context.route).toBe("user");
		expect(context.params.id).toBe("42");
		expect(context.source).toBe("navigate");
	});

	it("tags observed transitions separately from requested navigation", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		actor.send({ type: "NAVIGATION_OBSERVED", path: "/about" });
		expect(actor.getSnapshot().context.source).toBe("observed");
	});

	it("redirects a guarded route to /login when unauthenticated", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/dashboard" });
		const { context } = actor.getSnapshot();
		expect(context.route).toBe("login");
		expect(context.redirected).toBe(true);
	});

	it("allows the guarded route once authenticated", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		actor.send({ type: "LOGIN" });
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/dashboard" });
		const { context } = actor.getSnapshot();
		expect(context.route).toBe("dashboard");
		expect(context.redirected).toBe(false);
	});

	it("resolves unknown paths to not-found", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/missing" });
		expect(actor.getSnapshot().context.route).toBe("not-found");
	});

	it("emits a navigated event on each committed navigation", () => {
		const actor = createActor(routerMachine, { input: {} }).start();
		const seen: string[] = [];
		actor.on("navigated", (event) => seen.push(event.route));
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/about" });
		actor.send({ type: "NAVIGATE_REQUESTED", to: "/users/1" });
		expect(seen).toEqual(["about", "user"]);
	});

	it("exposes pure resolution for guard logic", () => {
		expect(resolveNavigation("/dashboard", false).route).toBe("login");
		expect(resolveNavigation("/dashboard", true).route).toBe("dashboard");
		expect(createInitialContext("/users/9").params.id).toBe("9");
	});
});
