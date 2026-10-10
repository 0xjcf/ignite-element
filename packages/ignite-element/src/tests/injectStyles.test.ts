import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	installStyleInject,
	injectStyles as queueStylesBeforeInjector,
} from "../../../ignite-renderer/src/styleHook";
import { setGlobalStyles } from "../globalStyles";
import injectStyles, { flushPendingStyles } from "../injectStyles";
import { createIgniteJsxRenderStrategy } from "../renderers/jsx/IgniteJsxRenderStrategy";

const STYLE_INJECT_SLOT = Symbol.for("ignite-element.style-inject");

type StyleInject = (root: ShadowRoot) => void;

function isStyleInject(value: unknown): value is StyleInject {
	return typeof value === "function";
}

describe("injectStyles", () => {
	let shadowRoot: ShadowRoot;
	let warnSpy: MockInstance<typeof console.warn>;

	const createShadowRoot = () => {
		const element = document.createElement(`test-component-${Math.random()}`);
		return element.attachShadow({ mode: "open" });
	};

	beforeEach(() => {
		// Create fresh shadow root with unique component name for each test
		shadowRoot = createShadowRoot();

		// Set up warn spy fresh for each test
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up
		warnSpy.mockRestore();
		setGlobalStyles(undefined);
		vi.restoreAllMocks();
	});

	it("should inject a valid global StyleObject into the shadow DOM", () => {
		setGlobalStyles({
			href: "./secure-style.css",
			integrity: "sha384-secure123",
			crossOrigin: "anonymous",
		});

		injectStyles(shadowRoot);

		const linkElement = shadowRoot.querySelector("link");
		expect(linkElement).toBeTruthy();
		if (!linkElement) {
			throw new Error("Expected stylesheet link to be injected.");
		}
		expect(linkElement?.rel).toBe("stylesheet");
		expect(linkElement?.href).toContain("secure-style.css");
		expect(linkElement?.integrity).toBe("sha384-secure123");
		expect(linkElement?.crossOrigin).toBe("anonymous");
	});

	it("should log a warning for invalid global styles", () => {
		setGlobalStyles("invalidStyle");

		injectStyles(shadowRoot);

		expect(warnSpy).toHaveBeenCalledWith(
			"Invalid global style path:",
			"invalidStyle",
		);
	});

	it("skips string .scss stylesheets and warns", () => {
		setGlobalStyles("./theme.scss");

		injectStyles(shadowRoot);

		expect(shadowRoot.querySelector("link")).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			"Skipping non-browser stylesheet path:",
			"./theme.scss",
		);
	});

	it("skips StyleObject .scss stylesheets after a pending flush and keeps roots deduped", () => {
		injectStyles(shadowRoot);
		setGlobalStyles({
			href: "./theme.scss",
			crossOrigin: "anonymous",
		});

		flushPendingStyles();
		flushPendingStyles();

		expect(shadowRoot.querySelectorAll("link")).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith(
			"Skipping non-browser stylesheet path:",
			"./theme.scss",
		);
	});

	it("keeps pending roots retryable after rejected stylesheet flushes and injects late valid css once per root", () => {
		const secondRoot = createShadowRoot();

		injectStyles(shadowRoot);
		injectStyles(secondRoot);
		setGlobalStyles("./theme.scss");

		flushPendingStyles();
		flushPendingStyles();

		expect(shadowRoot.querySelectorAll("link")).toHaveLength(0);
		expect(secondRoot.querySelectorAll("link")).toHaveLength(0);
		expect(warnSpy).toHaveBeenCalledTimes(1);

		setGlobalStyles("./theme.css");
		flushPendingStyles();
		flushPendingStyles();

		const links = shadowRoot.querySelectorAll("link");
		const secondLinks = secondRoot.querySelectorAll("link");
		expect(links).toHaveLength(1);
		expect(secondLinks).toHaveLength(1);
		expect(links[0]?.href).toContain("theme.css");
		expect(secondLinks[0]?.href).toContain("theme.css");
	});

	it("queues a root attached before the style injector loads", () => {
		const host = globalThis as typeof globalThis & {
			[STYLE_INJECT_SLOT]?: (root: ShadowRoot) => void;
		};
		const previous = host[STYLE_INJECT_SLOT];
		delete host[STYLE_INJECT_SLOT];
		const earlyRoot = createShadowRoot();

		try {
			queueStylesBeforeInjector(earlyRoot);
			setGlobalStyles(undefined);
			if (previous) installStyleInject(previous);

			setGlobalStyles("./late.css");
			flushPendingStyles();

			expect(earlyRoot.querySelector("link")?.href).toContain("late.css");
		} finally {
			if (previous) installStyleInject(previous);
		}
	});

	it("drops a shadow root when the JSX strategy detaches before the injector loads", () => {
		const slotHost = globalThis as typeof globalThis & {
			[STYLE_INJECT_SLOT]?: unknown;
		};
		const previous = slotHost[STYLE_INJECT_SLOT];
		delete slotHost[STYLE_INJECT_SLOT];
		const droppedElement = document.createElement("div");
		const keptElement = document.createElement("div");
		document.body.append(droppedElement, keptElement);
		const dropped = droppedElement.attachShadow({ mode: "open" });
		const kept = keptElement.attachShadow({ mode: "open" });

		try {
			const droppedStrategy = createIgniteJsxRenderStrategy();
			const keptStrategy = createIgniteJsxRenderStrategy();
			droppedStrategy.attach(dropped);
			keptStrategy.attach(kept);
			droppedStrategy.detach();

			const seen: ShadowRoot[] = [];
			installStyleInject((root) => {
				seen.push(root);
			});

			expect(seen).not.toContain(dropped);
			expect(seen).toContain(kept);
		} finally {
			droppedElement.remove();
			keptElement.remove();
			if (isStyleInject(previous)) installStyleInject(previous);
		}
	});

	it("does not inject styles into a shadow root removed before flush", () => {
		const slotHost = globalThis as typeof globalThis & {
			[STYLE_INJECT_SLOT]?: unknown;
		};
		const previous = slotHost[STYLE_INJECT_SLOT];
		delete slotHost[STYLE_INJECT_SLOT];
		const removedElement = document.createElement("div");
		const keptElement = document.createElement("div");
		document.body.append(removedElement, keptElement);
		const removed = removedElement.attachShadow({ mode: "open" });
		const kept = keptElement.attachShadow({ mode: "open" });

		try {
			queueStylesBeforeInjector(removed);
			queueStylesBeforeInjector(kept);
			removedElement.remove();
			expect(removed.isConnected).toBe(false);

			setGlobalStyles(undefined);
			installStyleInject(isStyleInject(previous) ? previous : injectStyles);
			setGlobalStyles("./detached.css");
			flushPendingStyles();

			expect(removed.querySelector("link")).toBeNull();
			expect(kept.querySelector("link")?.href).toContain("detached.css");
		} finally {
			keptElement.remove();
			setGlobalStyles(undefined);
			if (isStyleInject(previous)) installStyleInject(previous);
		}
	});

	it("does not flush styles into a connected root that was removed later", () => {
		const removedElement = document.createElement("div");
		const keptElement = document.createElement("div");
		document.body.append(removedElement, keptElement);
		const removed = removedElement.attachShadow({ mode: "open" });
		const kept = keptElement.attachShadow({ mode: "open" });

		try {
			setGlobalStyles(undefined);
			injectStyles(removed);
			injectStyles(kept);
			removedElement.remove();

			setGlobalStyles("./detached.css");
			flushPendingStyles();

			expect(removed.querySelector("link")).toBeNull();
			expect(kept.querySelector("link")?.href).toContain("detached.css");
		} finally {
			keptElement.remove();
			setGlobalStyles(undefined);
		}
	});

	it("should ignore redundant calls for the same shadow root", () => {
		setGlobalStyles({
			href: "./theme.css",
		});

		injectStyles(shadowRoot);
		injectStyles(shadowRoot);

		const links = shadowRoot.querySelectorAll("link");
		expect(links).toHaveLength(1);
	});
});
