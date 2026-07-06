// @vitest-environment jsdom
import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";
import {
	createInitialContext,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";
import { shouldHandleClientNavigation } from "./router";
import { createRouterNavigation, getBrowserPath } from "./routerStore";

const createNavigationTarget = (initialPath: string) => {
	let pathname = "/";
	let search = "";
	const listeners = new Map<string, EventListener>();
	const setPath = (path: string) => {
		const url = new URL(path, "https://example.test");
		pathname = url.pathname;
		search = url.search;
	};
	setPath(initialPath);

	const target = {
		get location() {
			return { pathname, search };
		},
		history: {
			pushState: vi.fn((_state: unknown, _title: string, to: string) => {
				setPath(to);
			}),
			replaceState: vi.fn((_state: unknown, _title: string, to: string) => {
				setPath(to);
			}),
		},
		addEventListener: vi.fn((type: string, listener: EventListener) => {
			listeners.set(type, listener);
		}),
		removeEventListener: vi.fn((type: string, listener: EventListener) => {
			if (listeners.get(type) === listener) {
				listeners.delete(type);
			}
		}),
	};

	return { target, listeners, setPath };
};

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
		const actor = createActor(routerMachine, {
			input: undefined,
		}).start();
		const seen: Array<{
			parent: string;
			child: string | null;
			path: string;
		}> = [];
		actor.on("routed", (event) =>
			seen.push({
				parent: event.parent,
				child: event.child,
				path: event.path,
			}),
		);

		actor.send({ type: "NAVIGATE", to: "/docs/api" });

		expect(seen).toEqual([
			{
				parent: "docs",
				child: "api",
				path: "/docs/api",
			},
		]);
		actor.stop();
	});

	it("seeds route state from the current browser path", () => {
		const { target } = createNavigationTarget("/settings/billing?plan=team");
		const actor = createActor(routerMachine, {
			input: { path: getBrowserPath(target) },
		}).start();

		expect(actor.getSnapshot().context).toMatchObject({
			parent: "settings",
			child: "billing",
			path: "/settings/billing",
		});

		actor.stop();
	});

	it("does not rewrite history when only the current query differs", () => {
		const { target } = createNavigationTarget("/docs/api?tab=reference");
		const actor = createActor(routerMachine, {
			input: { path: getBrowserPath(target) },
		}).start();
		const navigation = createRouterNavigation(actor, target);

		navigation.navigate("/docs/api");

		expect(target.history.pushState).not.toHaveBeenCalled();
		expect(target.history.replaceState).not.toHaveBeenCalled();
		expect(actor.getSnapshot().context).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});

		actor.stop();
	});

	it("keeps browser history and route state synchronized", () => {
		const { target, listeners, setPath } = createNavigationTarget("/");
		const actor = createActor(routerMachine, {
			input: { path: getBrowserPath(target) },
		}).start();
		const navigation = createRouterNavigation(actor, target);
		const subscription = navigation.installPopstateSync();

		navigation.navigate("/docs/api");

		expect(target.history.pushState).toHaveBeenCalledWith(
			null,
			"",
			"/docs/api",
		);
		expect(actor.getSnapshot().context).toMatchObject({
			parent: "docs",
			child: "api",
		});

		navigation.navigate("/docs/unknown?tab=api");

		expect(target.history.pushState).toHaveBeenLastCalledWith(
			null,
			"",
			"/docs/unknown",
		);
		expect(actor.getSnapshot().context).toMatchObject({
			parent: "not-found",
			child: null,
			path: "/docs/unknown",
		});

		setPath("/settings/billing");
		listeners.get("popstate")?.(new Event("popstate"));

		expect(actor.getSnapshot().context).toMatchObject({
			parent: "settings",
			child: "billing",
		});

		subscription.unsubscribe();
		expect(target.removeEventListener).toHaveBeenCalledWith(
			"popstate",
			expect.any(Function),
		);
		actor.stop();
	});

	it("only intercepts normal left-click parent navigation", () => {
		expect(
			shouldHandleClientNavigation(new MouseEvent("click", { button: 0 })),
		).toBe(true);
		expect(
			shouldHandleClientNavigation(new MouseEvent("click", { button: 1 })),
		).toBe(false);
		expect(
			shouldHandleClientNavigation(
				new MouseEvent("click", { button: 0, metaKey: true }),
			),
		).toBe(false);
		expect(
			shouldHandleClientNavigation(
				new MouseEvent("click", { button: 0, ctrlKey: true }),
			),
		).toBe(false);
		expect(
			shouldHandleClientNavigation(
				new MouseEvent("click", { button: 0, shiftKey: true }),
			),
		).toBe(false);
		expect(
			shouldHandleClientNavigation(
				new MouseEvent("click", { button: 0, altKey: true }),
			),
		).toBe(false);

		const prevented = new MouseEvent("click", {
			button: 0,
			cancelable: true,
		});
		prevented.preventDefault();

		expect(shouldHandleClientNavigation(prevented)).toBe(false);
	});
});
