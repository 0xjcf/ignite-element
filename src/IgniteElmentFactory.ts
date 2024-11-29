import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export interface IgniteElementConfig {
  styles?: { custom?: string; paths?: string[] };
}

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
  styles?: { custom?: string; paths?: string[] }
): void {
  if (!styles || !styles.paths) return;

  // Add external stylesheet links
  styles?.paths.forEach((path) => {
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";
    linkElement.href = path;
    shadowRoot.appendChild(linkElement);
  });

  // Add inline custom styles
  if (styles.custom) {
    const styleElement = document.createElement("style");
    styleElement.textContent = styles.custom;
    shadowRoot.appendChild(styleElement);
  }
}
