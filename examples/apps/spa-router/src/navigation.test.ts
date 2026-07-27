import { describe, expect, it } from "vitest";
import { createBrowserNavigation } from "./navigation";

type NavigateListener = (event: Event) => void;

const createFakeNavigation = (initialUrl = "https://example.test/") => {
	let currentUrl = initialUrl;
	const listeners = new Set<NavigateListener>();

	const dispatchNavigate = (url: string, overrides: Record<string, unknown> = {}) => {
		let intercepted = false;
		const event = {
			type: "navigate",
			canIntercept: true,
			hashChange: false,
			downloadRequest: null,
			destination: { url },
			intercept: ({ handler }: { handler?: () => void } = {}) => {
				intercepted = true;
				currentUrl = url;
				handler?.();
			},
			...overrides,
		} as unknown as Event;

		for (const listener of listeners) {
			listener(event);
		}

		return { intercepted };
	};

	return {
		get currentEntry() {
			return { url: currentUrl };
		},
		addEventListener(_type: string, listener: NavigateListener) {
			listeners.add(listener);
		},
		removeEventListener(_type: string, listener: NavigateListener) {
			listeners.delete(listener);
		},
		dispatchEvent(_event: Event) {
			return true;
		},
		navigate(path: string) {
			const url = new URL(path, currentUrl).toString();
			dispatchNavigate(url);
			return { committed: Promise.resolve() };
		},
		dispatchNavigate,
	};
};

describe("browser navigation adapter", () => {
	it("filters non-interceptable, cross-origin, hash-only, and download navigations", () => {
		const navigation = createFakeNavigation("https://example.test/docs");
		const port = createBrowserNavigation(navigation);
		const seen: string[] = [];

		port.observe((path) => {
			seen.push(path);
		});

		navigation.dispatchNavigate("https://example.test/docs#hash", {
			hashChange: true,
		});
		navigation.dispatchNavigate("https://other.test/docs");
		navigation.dispatchNavigate("https://example.test/download", {
			downloadRequest: "file.zip",
		});
		navigation.dispatchNavigate("https://example.test/no-intercept", {
			canIntercept: false,
		});
		navigation.dispatchNavigate("https://example.test/about");

		expect(seen).toEqual(["/about"]);
	});

	it("suppresses self-originated commits while still intercepting the browser event", async () => {
		const navigation = createFakeNavigation("https://example.test/");
		const port = createBrowserNavigation(navigation);
		const seen: string[] = [];

		port.observe((path) => {
			seen.push(path);
		});

		await port.commit("/about", "push");

		expect(seen).toEqual([]);
		expect(port.currentPath()).toBe("/about");
	});
});
