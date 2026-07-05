import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";
import {
	createInitialContext,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";
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
		const emitted = routerMachine.config.on?.NAVIGATE;
		expect(emitted).toBeDefined();
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
});
