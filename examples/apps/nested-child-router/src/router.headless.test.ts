import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { routerMachine } from "./routerMachine";

const makeRouter = () =>
	igniteCore({
		source: routerMachine,
		view: ({ snapshot }) => ({
			parent: snapshot.context.parent,
			child: snapshot.context.child,
			path: snapshot.context.path,
			label: snapshot.context.label,
		}),
		commands: ({ actor }) => ({
			navigate: (to: string) => actor.send({ type: "NAVIGATE", to }),
			openDocSection: (section: "overview" | "api" | "examples") =>
				actor.send({ type: "OPEN_DOC_SECTION", section }),
			openSettingsPanel: (panel: "profile" | "billing") =>
				actor.send({ type: "OPEN_SETTINGS_PANEL", panel }),
		}),
	});

describe("nested child router — headless runtime", () => {
	it("drives a child outlet through a scoped command", async () => {
		const router = makeRouter();

		await router.execute("openDocSection", "api");

		expect(router.getView()).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
			label: "API reference",
		});
	});

	it("keeps parent and child projections in sync across route changes", async () => {
		const router = makeRouter();

		await router.execute("navigate", "/settings/billing");
		expect(router.getView()).toMatchObject({
			parent: "settings",
			child: "billing",
		});

		await router.execute("openDocSection", "examples");
		expect(router.getView()).toMatchObject({
			parent: "docs",
			child: "examples",
			path: "/docs/examples",
		});
	});

	it("captures nested route events in execute().events", async () => {
		const router = makeRouter();

		const result = await router.execute("navigate", "/docs/api");

		expect(result.events).toContainEqual({
			type: "routed",
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});
	});
});
