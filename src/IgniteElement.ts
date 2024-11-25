import { render, TemplateResult } from "lit-html";
import { IgniteAdapter } from "./IgniteAdapter";

export abstract class IgniteElement<State, Event> extends HTMLElement {
  private _adapter: IgniteAdapter<State, Event>;
  public _shadowRoot: ShadowRoot;
  protected _currentState!: State;
  private _unsubscribe!: () => void;

  constructor(adapter: IgniteAdapter<State, Event>) {
    super();
    this._adapter = adapter;
    this._shadowRoot = this.attachShadow({ mode: "open" });
    this._currentState = this._adapter.getState();
  }

  connectedCallback(): void {
    const subscription = this._adapter.subscribe((state) => {
      this._currentState = state;
      this.renderTemplate();
    });
    this._unsubscribe = subscription.unsubscribe;
    this.renderTemplate(); // initial render
  }

  disconnectedCallback(): void {
    // cleanup is handled within the adapters
    if (this._unsubscribe) this._unsubscribe();
    this._adapter.stop();
  }

  protected send(event: Event): void {
    this._adapter.send(event);
  }

  protected get state(): State {
    return this._adapter.getState();
  }

  private renderTemplate(): void {
    if (!this._currentState) {
      console.warn(`[IgniteElement] State is not initialized`);
      return;
    }
    render(this.render(), this._shadowRoot);
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
export function igniteElement<State, Event>(
  elementName: string,
  adapter: IgniteAdapter<State, Event>,
  renderFn: (state: State, send: (event: Event) => void) => TemplateResult
) {
  class Element extends IgniteElement<State, Event> {
    constructor() {
      super(adapter);
    }

    protected render(): TemplateResult {
      return renderFn(this.state, (event) => this.send(event));
    }
  }

  customElements.define(elementName, Element);
}
