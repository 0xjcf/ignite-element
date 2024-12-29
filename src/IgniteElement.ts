import { render, TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";

export default abstract class IgniteElement<State, Event> extends HTMLElement {
  private _adapter: IgniteAdapter<State, Event> | undefined;
  public _shadowRoot: ShadowRoot;
  protected _currentState!: State;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: "open" });
  }

  setAdapter(adapter: IgniteAdapter<State, Event>) {
    this._adapter = adapter;

    this._adapter.subscribe((state) => {
      this._currentState = state;
      this.renderTemplate();
    });
  }

  connectedCallback(): void {
    this.renderTemplate(); // initial render
    this.addEventListener("send", (event) => this.send(event));
  }

  disconnectedCallback(): void {
    this._adapter?.stop();
  }

  protected send<Event>(event: Event): void {
    // Support both CustomEvents and plain objects
    const action =
      event instanceof CustomEvent && event.detail ? event.detail : event;
    this._adapter?.send(action);
  }

  protected get state(): State {
    return this._adapter?.getState() || this._currentState;
  }

  private renderTemplate(): void {
    if (!this._currentState) {
      console.warn(`[IgniteElement] State is not initialized`);
      return;
    }
    render(
      this.render({
        state: this._currentState,
        send: (event: Event) => this.send(event),
      }),
      this._shadowRoot
    );
  }

  protected abstract render(props: {
    state: State;
    send: (event: Event) => void;
  }): TemplateResult;
}
