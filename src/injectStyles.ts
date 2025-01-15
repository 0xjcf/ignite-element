import { getGlobalStyles, StyleObject } from "./globalStyles";

// Global cache to track loaded stylesheets and their content
const globalStyleCache = new Map<string, string>();

// Keep track of injected stylesheets per shadow root
const shadowRootCache = new WeakMap<ShadowRoot, Set<string>>();

// Debug flag to control logging
const DEBUG = false;

// Track components that have already been initialized
const initializedComponents = new Set<string>();

function debugCache(
  shadowRoot: ShadowRoot,
  href: string,
  action: "check" | "add"
) {
  // Get the host element (the web component instance)
  if (DEBUG) {
    const host = shadowRoot.host;
    const tagName = host.tagName.toLowerCase();

    console.debug(
      `[Style Cache ${action}] ${href}`,
      `Component: ${tagName}`,
      `Shadow cache exists: ${shadowRootCache.has(shadowRoot)}`,
      `Shadow cached: ${shadowRootCache.get(shadowRoot)?.has(href)}`,
      `Shadow cache contents: ${Array.from(
        shadowRootCache.get(shadowRoot) || []
      ).join(", ")}`
    );
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

  // Skip if we've already initialized this component type
  if (initializedComponents.has(tagName)) {
    if (DEBUG)
      console.debug(
        `[Style Cache] Skipping initialization for ${tagName} - already initialized`
      );
    return;
  }

  initializedComponents.add(tagName);

  const globalStyles = getGlobalStyles();

  // Initialize shadow root cache
  if (!shadowRootCache.has(shadowRoot)) {
    shadowRootCache.set(shadowRoot, new Set());
    if (DEBUG)
      console.debug("[Style Cache] Initialized new cache for shadow root");
  }
  const shadowStyles = shadowRootCache.get(shadowRoot)!;

  // Helper to inject stylesheet
  const injectStylesheet = (
    href: string,
    attributes?: Record<string, string | undefined>
  ) => {
    debugCache(shadowRoot, href, "check");

    // Skip if already injected in this shadow root
    if (shadowStyles.has(href)) {
      if (DEBUG)
        console.debug(
          `[Style Cache] Skipping duplicate style in shadow root: ${href}`
        );
      return;
    }

    if (DEBUG) console.debug(`[Style Cache] Injecting style: ${href}`);

    // If we have the styles cached, use them immediately
    if (globalStyleCache.has(href)) {
      const styleElement = document.createElement("style");
      styleElement.textContent = globalStyleCache.get(href)!;
      shadowRoot.appendChild(styleElement);
      shadowStyles.add(href);
      debugCache(shadowRoot, href, "add");
      return;
    }

    // First time loading this stylesheet
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";
    linkElement.href = href;

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value) linkElement.setAttribute(key, value);
      });
    }

    // Add to shadow root immediately for styles to take effect
    shadowRoot.appendChild(linkElement);
    shadowStyles.add(href);
  };

  // Inject global styles
  if (typeof globalStyles === "string") {
    if (
      globalStyles.trim().endsWith(".css") ||
      globalStyles.trim().endsWith(".scss")
    ) {
      injectStylesheet(globalStyles);
    } else {
      console.warn("Invalid global style path:", globalStyles);
    }
  } else if (typeof globalStyles === "object" && "href" in globalStyles) {
    injectStylesheet(globalStyles.href, {
      integrity: globalStyles.integrity,
      crossorigin: globalStyles.crossorigin,
    });
  }

  // Handle deprecated styles.paths (with warning)
  if (styles?.paths) {
    console.warn(
      "DEPRECATION WARNING: `styles.paths` is deprecated. Use `setGlobalStyles` instead."
    );
    styles.paths.forEach((style) => {
      if (typeof style === "string") {
        if (style.trim().endsWith(".css") || style.trim().endsWith(".scss")) {
          injectStylesheet(style);
        } else {
          console.warn("Invalid style path:", style);
        }
      } else if (typeof style === "object" && "href" in style) {
        injectStylesheet(style.href, {
          integrity: style.integrity,
          crossorigin: style.crossorigin,
        });
      }
    });
  }

  // Handle deprecated styles.custom (with warning)
  if (styles?.custom) {
    console.warn(
      "DEPRECATION WARNING: `styles.custom` is deprecated. Use style tags in your template instead."
    );
    const styleElement = document.createElement("style");
    styleElement.textContent = styles.custom;
    shadowRoot.appendChild(styleElement);
  }
}
