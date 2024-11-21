import { html, render, TemplateResult } from "lit-html";
import {
  createActor,
  AnyStateMachine,
  StateFrom,
  ContextFrom,
  EventFrom,
  Actor,
} from "xstate";

export abstract class IgniteElement<
  ElementMachine extends AnyStateMachine
> extends HTMLElement {
  private _actor: Actor<ElementMachine>;
  protected _currentState!: StateFrom<ElementMachine>;
  private _shadowRoot: ShadowRoot;

  constructor(machine: ElementMachine) {
    super();
    this._actor = createActor(machine);
    this._shadowRoot = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this._actor.subscribe((state) => {
      this._currentState = state;
      this.renderTemplate();
    });
    this._actor.start();

    this.updateGrid();
  }

  disconnectedCallback(): void {
    this._actor.stop();
  }

  /**
   * Send events to the machine
   */
  protected send(event: EventFrom<ElementMachine>): void {
    this._actor.send(event);
  }

  /**
   * Access current machine context
   */
  protected get context(): ContextFrom<ElementMachine> {
    return this._currentState?.context || {};
  }

  /**
   * Access current state value
   */
  protected get state(): StateFrom<ElementMachine> {
    return this._actor.getSnapshot()|| "";
  }

  protected renderTemplate(): void {
    if (this._currentState) {
      render(this.render(), this._shadowRoot);
    }
  }

  protected abstract render(): TemplateResult;

  static get observedAttributes() {
    return ["columns", "rows"];
  }

  private updateGrid() {
    const columns = this.getAttribute("columns");
    const rows = this.getAttribute("rows");
    this.style.setProperty(
      "--grid-template-columns",
      `repeat(${columns}, 1fr)`
    );
    this.style.setProperty("--grid-template-rows", `repeat(${rows}, 1fr)`);
  }

  attributeChangedCallback(name: string): void {
    if (name === "columns" || name === "rows") {
      this.updateGrid();
    }
  }
}

// IgniteElement function that uses IgniteElementBase
export function igniteElement<ElementMachine extends AnyStateMachine>(
  elementName: string,
  elementMachine: ElementMachine,
  renderFn: (
    state: StateFrom<ElementMachine>,
    send: (event: EventFrom<ElementMachine>) => void
  ) => TemplateResult
) {
  class Element extends IgniteElement<ElementMachine> {
    constructor() {
      super(elementMachine);
    }

    protected render(): TemplateResult {
      if (!this._currentState) {
        return html``;
      }

      return renderFn(this._currentState, (event) => this.send(event));
    }
  }

  customElements.define(elementName, Element);
}
