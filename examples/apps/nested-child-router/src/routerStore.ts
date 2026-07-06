import { createActor } from "xstate";
import {
	type DocsSection,
	type NestedRouteEvent,
	type SettingsPanel,
	pathForDocSection,
	pathForSettingsPanel,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";

type RouterActorRef = {
	send: (event: NestedRouteEvent) => void;
};

type RouterNavigationTarget = {
	location: Pick<Location, "pathname" | "search">;
	history: Pick<History, "pushState" | "replaceState">;
	addEventListener: Window["addEventListener"];
	removeEventListener: Window["removeEventListener"];
};

type NavigationOptions = {
	replace?: boolean;
};

const resolveBrowserTarget = (): RouterNavigationTarget | undefined =>
	typeof window === "undefined" ? undefined : window;

export const getBrowserPath = (
	target:
		| Pick<RouterNavigationTarget, "location">
		| undefined = resolveBrowserTarget(),
): string => {
	if (!target) {
		return "/";
	}

	const path = `${target.location.pathname}${target.location.search}`;
	return path === "" ? "/" : path;
};

const updateBrowserPath = (
	target: RouterNavigationTarget | undefined,
	to: string,
	options: NavigationOptions = {},
) => {
	if (!target) {
		return;
	}

	const normalizedTo = resolveNestedRoute(to).path;
	const currentPath = resolveNestedRoute(target.location.pathname).path;
	if (currentPath === normalizedTo) {
		return;
	}

	if (options.replace) {
		target.history.replaceState(null, "", normalizedTo);
		return;
	}

	target.history.pushState(null, "", normalizedTo);
};

export const createRouterNavigation = (
	actor: RouterActorRef,
	target: RouterNavigationTarget | undefined = resolveBrowserTarget(),
) => ({
	navigate(to: string, options?: NavigationOptions) {
		updateBrowserPath(target, to, options);
		actor.send({ type: "NAVIGATE", to });
	},
	openDocSection(section: DocsSection, options?: NavigationOptions) {
		updateBrowserPath(target, pathForDocSection(section), options);
		actor.send({ type: "OPEN_DOC_SECTION", section });
	},
	openSettingsPanel(panel: SettingsPanel, options?: NavigationOptions) {
		updateBrowserPath(target, pathForSettingsPanel(panel), options);
		actor.send({ type: "OPEN_SETTINGS_PANEL", panel });
	},
	installPopstateSync() {
		if (!target) {
			return { unsubscribe() {} };
		}

		const listener = () => {
			actor.send({ type: "NAVIGATE", to: getBrowserPath(target) });
		};

		target.addEventListener("popstate", listener);
		return {
			unsubscribe: () => target.removeEventListener("popstate", listener),
		};
	},
});

export const routerActor = createActor(routerMachine, {
	input: { path: getBrowserPath() },
}).start();

export const routerNavigation = createRouterNavigation(routerActor);
export const routerHistorySubscription = routerNavigation.installPopstateSync();
