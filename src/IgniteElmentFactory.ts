import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export interface IgniteElementConfig {
  styles?: { custom?: string; paths?: (string | StyleObject)[] };
}

export interface StyleObject {
  href: string;
  integrity?: string;
  crossorigin?: string;
}

type IgniteElementMethod<State, Event> = (
  elementName: string,
  renderFn: (state: State, send: (event: Event) => void) => TemplateResult
) => IgniteElement<State, Event>;

export interface IgniteCore<State, Event> {
  shared: IgniteElementMethod<State, Event>;
  isolated: IgniteElementMethod<State, Event>;
}

export default function igniteElementFactory<State, Event>(
  adapterFactory: () => IgniteAdapter<State, Event>,
  config?: IgniteElementConfig
): IgniteCore<State, Event> {
  let sharedAdapter: IgniteAdapter<State, Event> | null = null;

  return {
    /**
     * Create a component with shared state
     */
    shared(elementName, renderFn) {
      if (!sharedAdapter) {
        sharedAdapter = adapterFactory();
      }

      class SharedElement extends IgniteElement<State, Event> {
        constructor() {
          super(sharedAdapter!);
          injectStyles(this._shadowRoot, config?.styles);
        }

        protected render(): TemplateResult {
          return renderFn(this._currentState, (event) => this.send(event));
        }
      }

      customElements.define(elementName, SharedElement);
      return new SharedElement();
    },

    /**
     * Create a component with isolated state
     */
    isolated(elementName, renderFn) {
      class IsolatedElement extends IgniteElement<State, Event> {
        constructor() {
          const isolatedAdapter = adapterFactory();
          super(isolatedAdapter);
          injectStyles(this._shadowRoot, config?.styles);
        }

        protected render(): TemplateResult {
          return renderFn(this._currentState, (event) => this.send(event));
        }
      }

      customElements.define(elementName, IsolatedElement);
      return new IsolatedElement();
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
