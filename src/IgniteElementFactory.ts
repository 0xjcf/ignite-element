import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";
import injectStyles from "./injectStyles";

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
