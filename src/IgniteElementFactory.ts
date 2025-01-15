import { TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

// Configuration for Ignite Elements
export interface IgniteElementConfig {
  styles?: { custom?: string; paths?: (string | StyleObject)[] };
}

export interface StyleObject {
  href: string;
  integrity?: string;
  crossorigin?: string;
}

// Render Function Arguments
export type RenderFnArgs<State, Event> = {
  state: State;
  send: (event: Event) => void;
};

// Core Interface for Ignite Factory
export interface IgniteCore<State, Event> {
  shared: (
    elementName: string,
    renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult
  ) => IgniteElement<State, Event>;

  isolated: (
    elementName: string,
    renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult
  ) => IgniteElement<State, Event>;

  Shared: (
    tagName: string
  ) => <Constructor extends RenderableComponent<State, Event>>(
    constructor: Constructor
  ) => void;

  Isolated: (
    tagName: string
  ) => <Constructor extends RenderableComponent<State, Event>>(
    constructor: Constructor
  ) => void;
}

// Enforce Component Structure
export interface RenderableComponent<State, Event> {
  new (): {
    render(props: RenderFnArgs<State, Event>): TemplateResult;
  };
}

// Factory Function
export default function igniteElementFactory<State, Event>(
  igniteAdapter: () => IgniteAdapter<State, Event>,
  config?: IgniteElementConfig
): IgniteCore<State, Event> {
  let sharedAdapter: IgniteAdapter<State, Event> | null = null;

  function createSharedElement(
    elementName: string,
    renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult
  ) {
    if (!sharedAdapter) {
      sharedAdapter = igniteAdapter();
    }

    class SharedElement extends IgniteElement<State, Event> {
      constructor() {
        super(sharedAdapter!, config?.styles);
      }

      protected render(): TemplateResult {
        return renderFn({
          state: this.currentState,
          send: (event) => this.send(event),
        });
      }
    }

    customElements.define(elementName, SharedElement);
  }

  function createIsolatedElement(
    elementName: string,
    renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult
  ) {
    class IsolatedElement extends IgniteElement<State, Event> {
      constructor() {
        const isolatedAdapter = igniteAdapter();
        super(isolatedAdapter, config?.styles);
      }

      protected render(): TemplateResult {
        return renderFn({
          state: this.currentState,
          send: (event) => this.send(event),
        });
      }
    }

    customElements.define(elementName, IsolatedElement);
  }

  // Shared Decorator
  function Shared(tagName: string) {
    return function <T extends RenderableComponent<State, Event>>(
      constructor: T
    ) {
      createSharedElement(tagName, ({ state, send }) =>
        new constructor().render({ state, send })
      );
    };
  }

  // Isolated Decorator
  function Isolated(tagName: string) {
    return function <T extends RenderableComponent<State, Event>>(
      constructor: T
    ) {
      createIsolatedElement(tagName, ({ state, send }) =>
        new constructor().render({ state, send })
      );
    };
  }

  return {
    shared: createSharedElement,
    isolated: createIsolatedElement,
    Shared,
    Isolated,
  };
}
