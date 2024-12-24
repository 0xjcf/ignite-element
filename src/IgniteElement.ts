import { render, TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";

export default abstract class IgniteElement<State, Event> extends HTMLElement {
  private _adapter: IgniteAdapter<State, Event>;
  public _shadowRoot: ShadowRoot;
  protected _currentState!: State;

  constructor(adapter: IgniteAdapter<State, Event>) {
    super();
    this._adapter = adapter;
    this._shadowRoot = this.attachShadow({ mode: "open" });
    this._currentState = this._adapter.getState();
    this.addEventListener("send", (event) => this.send(event));
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

  protected send<Event>(event: Event): void {
    // Support both CustomEvents and plain objects
    const action =
      event instanceof CustomEvent && event.detail ? event.detail : event;
    this._adapter.send(action);
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
