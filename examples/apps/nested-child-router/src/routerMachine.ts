import { assign, emit, setup } from "xstate";

export type ParentRoute = "home" | "docs" | "settings" | "not-found";
export type DocsSection = "overview" | "api" | "examples";
export type SettingsPanel = "profile" | "billing";
export type ChildRoute = DocsSection | SettingsPanel | null;
export type RouteSource = "init" | "navigate" | "child";

export type NestedRouteContext = {
	path: string;
	parent: ParentRoute;
	child: ChildRoute;
	label: string;
	source: RouteSource;
};

export type NestedRouteEvent =
	| { type: "NAVIGATE"; to: string }
	| { type: "OPEN_DOC_SECTION"; section: DocsSection }
	| { type: "OPEN_SETTINGS_PANEL"; panel: SettingsPanel };

export type NestedRouteEmitted = {
	type: "routed";
	parent: ParentRoute;
	child: ChildRoute;
	path: string;
};

type ResolvedNestedRoute = Omit<NestedRouteContext, "source">;

const docsPathBySection: Record<DocsSection, string> = {
	overview: "/docs",
	api: "/docs/api",
	examples: "/docs/examples",
};

const settingsPathByPanel: Record<SettingsPanel, string> = {
	profile: "/settings",
	billing: "/settings/billing",
};

const labels: Record<Exclude<ChildRoute, null> | ParentRoute, string> = {
	home: "Home",
	docs: "Docs",
	settings: "Settings",
	"not-found": "Not found",
	overview: "Docs overview",
	api: "API reference",
	examples: "Worked examples",
	profile: "Profile settings",
	billing: "Billing settings",
};

const normalizePath = (path: string): string => {
	const pathname = path.split("?")[0].replace(/\/+$/, "");
	return pathname === "" ? "/" : pathname;
};

export const pathForDocSection = (section: DocsSection): string =>
	docsPathBySection[section];

export const pathForSettingsPanel = (panel: SettingsPanel): string =>
	settingsPathByPanel[panel];

export const resolveNestedRoute = (path: string): ResolvedNestedRoute => {
	const normalizedPath = normalizePath(path);

	if (normalizedPath === "/") {
		return {
			path: "/",
			parent: "home",
			child: null,
			label: labels.home,
		};
	}

	const docsMatch = Object.entries(docsPathBySection).find(
		([, routePath]) => routePath === normalizedPath,
	) as [DocsSection, string] | undefined;
	if (docsMatch) {
		const [child] = docsMatch;
		return {
			path: normalizedPath,
			parent: "docs",
			child,
			label: labels[child],
		};
	}

	const settingsMatch = Object.entries(settingsPathByPanel).find(
		([, routePath]) => routePath === normalizedPath,
	) as [SettingsPanel, string] | undefined;
	if (settingsMatch) {
		const [child] = settingsMatch;
		return {
			path: normalizedPath,
			parent: "settings",
			child,
			label: labels[child],
		};
	}

	return {
		path: normalizedPath,
		parent: "not-found",
		child: null,
		label: labels["not-found"],
	};
};

export const createInitialContext = (path = "/"): NestedRouteContext => ({
	...resolveNestedRoute(path),
	source: "init",
});

const requestedPath = (
	event: NestedRouteEvent,
	currentPath: string,
): string => {
	switch (event.type) {
		case "NAVIGATE":
			return event.to;
		case "OPEN_DOC_SECTION":
			return pathForDocSection(event.section);
		case "OPEN_SETTINGS_PANEL":
			return pathForSettingsPanel(event.panel);
		default:
			return currentPath;
	}
};

export const routerMachine = setup({
	types: {
		context: {} as NestedRouteContext,
		events: {} as NestedRouteEvent,
		emitted: {} as NestedRouteEmitted,
		input: {} as { path?: string } | undefined,
	},
	actions: {
		applyRoute: assign(
			({ context, event }, params: { source: RouteSource }) => ({
				...resolveNestedRoute(requestedPath(event, context.path)),
				source: params.source,
			}),
		),
		announceRoute: emit(({ context }) => ({
			type: "routed" as const,
			parent: context.parent,
			child: context.child,
			path: context.path,
		})),
	},
}).createMachine({
	context: ({ input }) => createInitialContext(input?.path),
	on: {
		NAVIGATE: {
			actions: [
				{ type: "applyRoute", params: { source: "navigate" } },
				"announceRoute",
			],
		},
		OPEN_DOC_SECTION: {
			actions: [
				{ type: "applyRoute", params: { source: "child" } },
				"announceRoute",
			],
		},
		OPEN_SETTINGS_PANEL: {
			actions: [
				{ type: "applyRoute", params: { source: "child" } },
				"announceRoute",
			],
		},
	},
});
