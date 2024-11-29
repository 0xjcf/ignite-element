import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export default function igniteElementFactory<State, Event>(
  adapterFactory: () => IgniteAdapter<State, Event>
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
