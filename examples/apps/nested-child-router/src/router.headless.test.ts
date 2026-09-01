import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { createMemoryNavigation } from "./navigation";
import { createRouterSource } from "./routerSource";

const makeRouter = () =>
	igniteCore({
		source: createRouterSource({
			navigation: createMemoryNavigation("/"),
		}),
		states: (snapshot) => ({
			parent: snapshot.context.parent,
			child: snapshot.context.child,
			path: snapshot.context.path,
			label: snapshot.context.label,
		}),
		commands: ({ actor }) => ({
			navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
			openDocSection: (section: "overview" | "api" | "examples") =>
				actor.send({ type: "OPEN_DOC_SECTION", section }),
			openSettingsPanel: (panel: "profile" | "billing") =>
				actor.send({ type: "OPEN_SETTINGS_PANEL", panel }),
		}),
	});

describe("nested child router — headless runtime", () => {
	it("drives a child outlet through a scoped command", async () => {
		const router = makeRouter();

		await router.execute({ command: "openDocSection", input: "api" });

		expect(router.getStates()).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
			label: "API reference",
		});
	});

	it("keeps parent and child projections in sync across route changes", async () => {
		const router = makeRouter();

		await router.execute({ command: "navigate", input: "/settings/billing" });
		expect(router.getStates()).toMatchObject({
			parent: "settings",
			child: "billing",
		});

		await router.execute({ command: "openDocSection", input: "examples" });
		expect(router.getStates()).toMatchObject({
			parent: "docs",
			child: "examples",
			path: "/docs/examples",
		});
	});

	it("captures nested route events in execute().events", async () => {
		const router = makeRouter();

		const result = await router.execute({
			command: "navigate",
			input: "/docs/api",
		});

		expect(result.events).toContainEqual({
			type: "routed",
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});
	});
});
