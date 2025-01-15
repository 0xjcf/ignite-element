import { getGlobalStyles, StyleObject } from "./globalStyles";

// Global caches
const shadowRootCache = new WeakMap<ShadowRoot, Set<string>>();
const initializedComponents = new Set<string>();

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

export default function injectStyles(
  shadowRoot: ShadowRoot,
  styles?: {
    custom?: string;
    paths?: (string | StyleObject)[];
  }
): void {
  const host = shadowRoot.host;
  const tagName = host.tagName.toLowerCase();

  // Skip if already initialized
  if (initializedComponents.has(tagName)) {
    debugLog(
      DebugNamespace.COMPONENT,
      `Skipping initialization for ${tagName} - already initialized`
    );
    return;
  }

  initializedComponents.add(tagName);
  debugLog(DebugNamespace.COMPONENT, `Initializing ${tagName}`);

  const globalStyles = getGlobalStyles();

  // Initialize shadow root cache
  if (!shadowRootCache.has(shadowRoot)) {
    shadowRootCache.set(shadowRoot, new Set());
    debugLog(DebugNamespace.CACHE, "Initialized new cache for shadow root");
  }
  const shadowStyles = shadowRootCache.get(shadowRoot)!;

  // Helper to inject stylesheet
  const injectStylesheet = (
    href: string,
    attributes?: Record<string, string | undefined>
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
      linkElement.outerHTML
    );
  };

  // Handle global styles
  if (typeof globalStyles === "string") {
    debugLog(DebugNamespace.GLOBAL_STYLES, "Processing string:", globalStyles);
    if (
      globalStyles.trim().endsWith(".css") ||
      globalStyles.trim().endsWith(".scss")
    ) {
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

  // Handle deprecated styles.paths
  if (styles?.paths) {
    debugLog(DebugNamespace.WARN, "Processing deprecated styles.paths");
    console.warn(
      "DEPRECATION WARNING: `styles.paths` is deprecated. Use `setGlobalStyles` instead."
    );
    styles.paths.forEach((style) => {
      // Add validation for invalid types first
      if (
        typeof style !== "string" &&
        (typeof style !== "object" || !style || !("href" in style))
      ) {
        console.warn("Invalid style path/object:", style);
        return;
      }

      if (typeof style === "string") {
        if (style.trim().endsWith(".css") || style.trim().endsWith(".scss")) {
          injectStylesheet(style);
        } else {
          debugLog(DebugNamespace.WARN, "Invalid style path");
          console.warn("Invalid style path/object:", style);
        }
      } else if (typeof style === "object" && "href" in style) {
        injectStylesheet(style.href, {
          integrity: style.integrity,
          crossOrigin: style.crossOrigin,
        });
      }
    });
  }

  // Handle deprecated styles.custom
  if (styles?.custom) {
    debugLog(DebugNamespace.WARN, "Processing deprecated styles.custom");
    console.warn(
      "DEPRECATION WARNING: `styles.custom` is deprecated. Use `setGlobalStyles` instead."
    );
    const styleElement = document.createElement("style");
    styleElement.textContent = styles.custom;
    shadowRoot.appendChild(styleElement);
    debugLog(
      DebugNamespace.LINK_ELEMENT,
      "Added custom style:",
      styleElement.outerHTML
    );
  }
}
