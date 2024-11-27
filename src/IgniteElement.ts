import { render, TemplateResult } from "lit-html";
import { IgniteAdapter } from "./IgniteAdapter";

export abstract class IgniteElement<State, Event> extends HTMLElement {
  private _adapter: IgniteAdapter<State, Event>;
  public _shadowRoot: ShadowRoot;
  protected _currentState!: State;

  constructor(adapter: IgniteAdapter<State, Event>) {
    super();
    this._adapter = adapter;
    this._shadowRoot = this.attachShadow({ mode: "open" });
    this._currentState = this._adapter.getState();
  }

  connectedCallback(): void {
    this._adapter.subscribe((state) => {
      this._currentState = state;
      this.renderTemplate();
    });
    this.renderTemplate(); // initial render
  }

  disconnectedCallback(): void {
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
}
