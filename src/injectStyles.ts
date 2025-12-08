import { getGlobalStyles } from "./globalStyles";

// Global caches
const shadowRootCache = new WeakMap<ShadowRoot, Set<string>>();
const initializedRoots = new WeakSet<ShadowRoot>();

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

	initializedRoots.add(shadowRoot);
	debugLog(DebugNamespace.COMPONENT, "Initializing new shadow root");

	const globalStyles = getGlobalStyles();

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
			return;
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
	};

	const isStylesheetPath = (path: string) => {
		const normalized = path.trim();
		const withoutQuery = normalized.split("?")[0]?.split("#")[0] ?? normalized;
		return withoutQuery.endsWith(".css") || withoutQuery.endsWith(".scss");
	};

	// Handle global styles
	if (typeof globalStyles === "string") {
		debugLog(DebugNamespace.GLOBAL_STYLES, "Processing string:", globalStyles);
		if (isStylesheetPath(globalStyles)) {
			injectStylesheet(globalStyles);
		} else {
			debugLog(DebugNamespace.WARN, "Invalid global style path");
			console.warn("Invalid global style path:", globalStyles);
		}
	} else if (
		typeof globalStyles === "object" &&
		globalStyles &&
		"href" in globalStyles
	) {
		debugLog(DebugNamespace.GLOBAL_STYLES, "Processing object:", globalStyles);
		injectStylesheet(globalStyles.href, {
			integrity: globalStyles.integrity,
			crossOrigin: globalStyles.crossOrigin,
		});
	}

	// Deprecated per-component styles have been removed (styles now managed globally)
}
