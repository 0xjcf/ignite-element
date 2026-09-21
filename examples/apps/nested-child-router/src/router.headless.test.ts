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
		commands: ({ source: actor }) => ({
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

		expect(router.get("states")).toMatchObject({
			parent: "docs",
			child: "api",
			path: "/docs/api",
			label: "API reference",
		});
	});

	it("keeps parent and child projections in sync across route changes", async () => {
		const router = makeRouter();

		await router.execute({ command: "navigate", input: "/settings/billing" });
		expect(router.get("states")).toMatchObject({
			parent: "settings",
			child: "billing",
		});

		await router.execute({ command: "openDocSection", input: "examples" });
		expect(router.get("states")).toMatchObject({
			parent: "docs",
			child: "examples",
			path: "/docs/examples",
		});
	});

	it("observes nested route events during execution", async () => {
		const router = makeRouter();

		const captured: Array<{ type: string; [key: string]: unknown }> = [];
		const eventHandles = [router.on("routed", (event) => captured.push(event))];
		await router.execute({
			command: "navigate",
			input: "/docs/api",
		});
		for (const handle of eventHandles) handle.unsubscribe();

		expect(captured).toContainEqual({
			type: "routed",
			parent: "docs",
			child: "api",
			path: "/docs/api",
		});
	});
});
