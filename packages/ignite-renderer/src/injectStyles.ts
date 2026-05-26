import { getGlobalStyles } from "./globalStyles";

// Global caches
const shadowRootCache = new WeakMap<ShadowRoot, Set<string>>();
const initializedRoots = new WeakSet<ShadowRoot>();
const pendingRoots = new Set<ShadowRoot>();

// Debug system
enum DebugNamespace {
	CACHE = "Style Cache",
	COMPONENT = "Component",
	GLOBAL_STYLES = "Global Styles",
	INJECT_STYLES = "Inject Styles",
	LINK_ELEMENT = "Link Element",
	WARN = "Warnings",
}

const DEBUG = false;

function debugLog(
	namespace: DebugNamespace,
	message: string,
	...args: unknown[]
) {
	if (DEBUG) {
		console.log(`[${namespace}] ${message}`, ...args);
	}
}

export default function injectStyles(shadowRoot: ShadowRoot): void {
	// Skip if this shadow root was already processed
	if (initializedRoots.has(shadowRoot)) {
		debugLog(
			DebugNamespace.COMPONENT,
			"Skipping initialization for shadow root - already initialized",
		);
		return;
	}

	debugLog(DebugNamespace.COMPONENT, "Initializing new shadow root");

	const globalStyles = getGlobalStyles();
	if (!globalStyles) {
		debugLog(
			DebugNamespace.GLOBAL_STYLES,
			"No globalStyles set when initializing shadow root. Pending for later flush.",
		);
		pendingRoots.add(shadowRoot);
		// Do not mark initialized; we'll retry once styles are available.
		return;
	}

	// Initialize shadow root cache
	let shadowStyles = shadowRootCache.get(shadowRoot);
	if (!shadowStyles) {
		shadowStyles = new Set<string>();
		shadowRootCache.set(shadowRoot, shadowStyles);
		debugLog(DebugNamespace.CACHE, "Initialized new cache for shadow root");
	}

	// Helper to inject stylesheet
	const injectStylesheet = (
		href: string,
		attributes?: Record<string, string | undefined>,
	) => {
		if (shadowStyles.has(href)) {
			debugLog(DebugNamespace.CACHE, `Skipping duplicate style: ${href}`);
			return true;
		}

		debugLog(DebugNamespace.INJECT_STYLES, "Loading new stylesheet:", {
			href,
			attributes,
		});

		const linkElement = document.createElement("link");
		linkElement.rel = "stylesheet";
		linkElement.href = href;

		if (attributes) {
			if (attributes.integrity) {
				linkElement.integrity = attributes.integrity;
			}
			if (attributes.crossOrigin) {
				linkElement.crossOrigin = attributes.crossOrigin;
			}
		}

		shadowRoot.appendChild(linkElement);
		shadowStyles.add(href);
		debugLog(
			DebugNamespace.LINK_ELEMENT,
			"Added to DOM:",
			linkElement.outerHTML,
		);
		return true;
	};

	const normalizeStylesheetPath = (path: string) => {
		const normalized = path.trim();
		return normalized.split("?")[0]?.split("#")[0] ?? normalized;
	};

	const isBrowserStylesheetPath = (path: string) => {
		return normalizeStylesheetPath(path).endsWith(".css");
	};

	const isScssStylesheetPath = (path: string) => {
		return normalizeStylesheetPath(path).endsWith(".scss");
	};

	const warnInvalidStylePath = (path: string) => {
		debugLog(DebugNamespace.WARN, "Invalid global style path");
		console.warn("Invalid global style path:", path);
	};

	const warnScssPath = (path: string) => {
		debugLog(DebugNamespace.WARN, "Skipping non-browser stylesheet path");
		console.warn("Skipping non-browser stylesheet path:", path);
	};

	let handledStyles = false;

	// Handle global styles
	if (typeof globalStyles === "string") {
		debugLog(DebugNamespace.GLOBAL_STYLES, "Processing string:", globalStyles);
		if (isBrowserStylesheetPath(globalStyles)) {
			handledStyles = injectStylesheet(globalStyles);
		} else if (isScssStylesheetPath(globalStyles)) {
			warnScssPath(globalStyles);
		} else {
			warnInvalidStylePath(globalStyles);
		}
	} else if (
		typeof globalStyles === "object" &&
		globalStyles &&
		"href" in globalStyles
	) {
		debugLog(DebugNamespace.GLOBAL_STYLES, "Processing object:", globalStyles);
		if (isBrowserStylesheetPath(globalStyles.href)) {
			handledStyles = injectStylesheet(globalStyles.href, {
				integrity: globalStyles.integrity,
				crossOrigin: globalStyles.crossOrigin,
			});
		} else if (isScssStylesheetPath(globalStyles.href)) {
			warnScssPath(globalStyles.href);
		} else {
			warnInvalidStylePath(globalStyles.href);
		}
	}

	if (!handledStyles) {
		pendingRoots.add(shadowRoot);
		return;
	}

	pendingRoots.delete(shadowRoot);
	initializedRoots.add(shadowRoot);

	// Deprecated per-component styles have been removed (styles now managed globally)
}

export function flushPendingStyles(): void {
	const globalStyles = getGlobalStyles();
	if (!globalStyles) {
		debugLog(
			DebugNamespace.GLOBAL_STYLES,
			"flushPendingStyles called but globalStyles is still unset",
		);
		return;
	}

	for (const root of Array.from(pendingRoots)) {
		pendingRoots.delete(root);
		debugLog(DebugNamespace.INJECT_STYLES, "Flushing pending root");
		injectStyles(root);
	}
}
