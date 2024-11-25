import { TemplateResult } from "lit-html";
import { IgniteAdapter } from "./IgniteAdapter";
import { IgniteElement } from "./IgniteElement";

export function igniteElementFactory<State, Event>(
  adapter: () => IgniteAdapter<State, Event>
) {
  let sharedAdapter: IgniteAdapter<State, Event>;

  return {
    /**
     * Create a component with shared state
     */
    shared(
      elementName: string,
      renderFn: (state: State, send: (event: Event) => void) => TemplateResult
    ) {
      if (!sharedAdapter) {
        sharedAdapter = adapter();
      }

      class SharedElement extends IgniteElement<State, Event> {
        constructor() {
          super(sharedAdapter);
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
        constructor() {
          super(adapter());
        }

        protected render(): TemplateResult {
          return renderFn(this._currentState, (event) => this.send(event));
        }
      }

      customElements.define(elementName, IsolatedElement);
    },
  };
}
