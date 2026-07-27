import { createBrowserNavigation } from "./navigation";
import { createRouterSource } from "./routerSource";

type NavigationWindow = Window & {
	navigation?: EventTarget & {
		currentEntry?: { url?: string };
		navigate: (path: string, options?: { history?: "push" | "replace" }) => {
			committed?: Promise<unknown>;
			finished?: Promise<unknown>;
		};
	};
};

const resolveBrowserNavigation = () => {
	if (typeof window === "undefined") {
		throw new Error(
			"The spa-router example requires the browser Navigation API.",
		);
	}

	const navigation = (window as NavigationWindow).navigation;
	if (!navigation) {
		throw new Error(
			"The spa-router example requires Navigation API support (Baseline 2026).",
		);
	}

	return navigation;
};

export const routerSource = createRouterSource({
	navigation: createBrowserNavigation(resolveBrowserNavigation()),
});

const hot = (import.meta as ImportMeta & {
	hot?: { dispose(callback: () => void): void };
}).hot;

if (hot) {
	hot.dispose(() => {
		routerSource.stop();
	});
}
