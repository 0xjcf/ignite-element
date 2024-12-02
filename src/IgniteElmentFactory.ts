import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export interface IgniteElementConfig {
  styles?: { custom?: string; paths?: string[] | StyleObject[] };
}

export type StyleObject = {
  href: string;
  integrity?: string;
  crossorigin?: string;
};

export default function igniteElementFactory<State, Event>(
  adapterFactory: () => IgniteAdapter<State, Event>,
  config: IgniteElementConfig
) {
  let sharedAdapter: IgniteAdapter<State, Event> | null = null;

  return {
    /**
     * Create a component with shared state
     */
    shared(
      elementName: string,
      renderFn: (state: State, send: (event: Event) => void) => TemplateResult
    ) {
      if (!sharedAdapter) {
        sharedAdapter = adapterFactory();
      }

      class SharedElement extends IgniteElement<State, Event> {
        constructor() {
          super(sharedAdapter!);
          injectStyles(this._shadowRoot, config.styles);
        }

        protected render(): TemplateResult {
          return renderFn(this._currentState, (event) => this.send(event));
        }
      }

      customElements.define(elementName, SharedElement);
    },

    /**
     * Create a component with isolated state
     */
    isolated(
      elementName: string,
      renderFn: (state: State, send: (event: Event) => void) => TemplateResult
    ) {
      class IsolatedElement extends IgniteElement<State, Event> {
        private isolatedAdapter: IgniteAdapter<State, Event>;

        constructor() {
          const isolatedAdapter = adapterFactory();
          super(isolatedAdapter);
          this.isolatedAdapter = isolatedAdapter;
          injectStyles(this._shadowRoot, config.styles);
        }

        protected render(): TemplateResult {
          return renderFn(this._currentState, (event) => this.send(event));
        }

        disconnectedCallback(): void {
          super.disconnectedCallback();
          this.isolatedAdapter.stop();
        }
      }

      customElements.define(elementName, IsolatedElement);
    },
  };
}

/**
 * Inject styles into the Shadow DOM
 * Handles both external stylesheet paths and inline custom styles
 */
function injectStyles(
  shadowRoot: ShadowRoot,
  styles?: {
    custom?: string;
    paths?: (string | StyleObject)[];
  }
): void {
  if (!styles) return;

  // Inject external stylesheet paths
  if (styles.paths) {
    styles.paths.forEach((style) => {
      if (typeof style === "string") {
        // Handle simple string paths
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = style;
        shadowRoot.appendChild(linkElement);
      } else if (typeof style === "object" && style.href) {
        // Handle objects with href, integrity, and crossorigin
        const linkElement = document.createElement("link");
        linkElement.rel = "stylesheet";
        linkElement.href = style.href;
        if (style.integrity) {
          linkElement.integrity = style.integrity;
        }
        if (style.crossorigin) {
          linkElement.crossOrigin = style.crossorigin;
        }
        shadowRoot.appendChild(linkElement);
      } else {
        console.warn("Invalid style path/object:", style);
      }
    });
  }

  // Inject custom inline styles
  if (styles.custom) {
    const styleElement = document.createElement("style");
    styleElement.textContent = styles.custom;
    shadowRoot.appendChild(styleElement);
  }
}
