import { getGlobalStyles, StyleObject } from "./globalStyles";

export default function injectStyles(
  shadowRoot: ShadowRoot,
  styles?: {
    custom?: string;
    paths?: (string | StyleObject)[];
  }
): void {
  const globalStyles = getGlobalStyles();

  // Inject global styles
  if (typeof globalStyles === "string") {
    if (
      globalStyles.trim().endsWith(".css") ||
      globalStyles.trim().endsWith(".scss")
    ) {
      const linkElement = document.createElement("link");
      linkElement.rel = "stylesheet";
      linkElement.href = globalStyles;
      shadowRoot.appendChild(linkElement);
    } else {
      console.warn("Invalid global style path:", globalStyles);
    }
  } else if (typeof globalStyles === "object" && "href" in globalStyles) {
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";
    linkElement.href = globalStyles.href;

    if (globalStyles.integrity) {
      linkElement.integrity = globalStyles.integrity;
    }
    if (globalStyles.crossorigin) {
      linkElement.crossOrigin = globalStyles.crossorigin;
    }

    shadowRoot.appendChild(linkElement);
  } else {
    console.warn("Invalid global style object:", globalStyles);
  }

  // Deprecation log for styles.paths
  if (styles?.paths) {
    console.warn(
      "DEPRECATION WARNING: `styles.paths` is deprecated. Use `setGlobalStyles` instead."
    );
    styles.paths?.forEach((style) => {
      if (
        typeof style === "string" &&
        (style.trim().endsWith(".css") || style.trim().endsWith(".scss"))
      ) {
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = style;
        shadowRoot.appendChild(linkElement);
      } else if (typeof style === "object" && "href" in style) {
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = style.href;
        if (style.integrity) linkElement.integrity = style.integrity;
        if (style.crossorigin) linkElement.crossOrigin = style.crossorigin;
        shadowRoot.appendChild(linkElement);
      } else {
        console.warn("Invalid style path/object:", style);
      }
    });
  }

  // Deprecation log for styles.custom
  if (styles?.custom) {
    console.warn(
      "DEPRECATION WARNING: `styles.custom` is deprecated. Use `setGlobalStyles` instead."
    );
    const styleElement = document.createElement("style");
    styleElement.textContent = styles.custom;
    shadowRoot.appendChild(styleElement);
  }
}
