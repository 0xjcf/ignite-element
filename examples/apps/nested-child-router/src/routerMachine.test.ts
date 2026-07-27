import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import {
	createInitialContext,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";

type ClickLike = {
	defaultPrevented: boolean;
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
};

const shouldHandleClientNavigation = (event: ClickLike): boolean =>
	!event.defaultPrevented &&
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

const click = (overrides: Partial<ClickLike> = {}): ClickLike => ({
	defaultPrevented: false,
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	...overrides,
});

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

		actor.send({ type: "NAVIGATE_REQUESTED", to: "/docs/api" });

		expect(seen).toEqual([
			{
				parent: "docs",
				child: "api",
				path: "/docs/api",
			},
		]);
		actor.stop();
	});

	it("tracks observed navigation separately from requested navigation", () => {
		const actor = createActor(routerMachine, {
			input: undefined,
		}).start();

		actor.send({ type: "NAVIGATION_OBSERVED", path: "/settings/billing" });

		expect(actor.getSnapshot().context).toMatchObject({
			parent: "settings",
			child: "billing",
			path: "/settings/billing",
			source: "observed",
		});
	});

	it("does not rewrite routing semantics when only the current query differs", () => {
		const actor = createActor(routerMachine, {
			input: { path: "/docs/api?tab=reference" },
		}).start();

		expect(actor.getSnapshot().context).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});
	});

	it("only intercepts normal left-click parent navigation", () => {
		expect(shouldHandleClientNavigation(click())).toBe(true);
		expect(shouldHandleClientNavigation(click({ button: 1 }))).toBe(false);
		expect(shouldHandleClientNavigation(click({ metaKey: true }))).toBe(false);
		expect(shouldHandleClientNavigation(click({ ctrlKey: true }))).toBe(false);
		expect(shouldHandleClientNavigation(click({ shiftKey: true }))).toBe(false);
		expect(shouldHandleClientNavigation(click({ altKey: true }))).toBe(false);
		expect(
			shouldHandleClientNavigation(click({ defaultPrevented: true })),
		).toBe(false);
	});
});
