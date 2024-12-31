import { render, TemplateResult } from "lit-html";
import IgniteAdapter from "./IgniteAdapter";
import injectStyles from "./injectStyles";
import { StyleObject } from "./globalStyles";

export default abstract class IgniteElement<State, Event> extends HTMLElement {
  private _adapter: IgniteAdapter<State, Event> | undefined;
  private _shadowRoot: ShadowRoot;
  private _currentState!: State;
  private _initialized = false;
  private _isActive = false;

  constructor(
    adapter: IgniteAdapter<State, Event>,
    styles?: { custom?: string; paths?: (string | StyleObject)[] }
  ) {
    super();
    this._shadowRoot = this.attachShadow({ mode: "open" });

    injectStyles(this._shadowRoot, styles);

    // Initialize adapter immediately during construction
    this._adapter = adapter;
    this._adapter.subscribe((state) => {
      if (this._isActive) {
        this._currentState = state;
        this.renderTemplate(); // Render updates
      }
    });

    // Sync the initial state
    this._currentState = this._adapter.getState();
    this._initialized = true; // Mark as initialized
  }

  connectedCallback(): void {
    this._isActive = true; // Reactivate updates
    this.addEventListener("send", (event) => this.send(event));
    this.renderTemplate(); // Render
  }

  disconnectedCallback(): void {
    this._isActive = false; // Pause updates
    this.removeEventListener("send", (event) => this.send(event));
  }

  protected send<Event>(event: Event): void {
    const action =
      event instanceof CustomEvent && event.detail ? event.detail : event;
    this._adapter?.send(action);
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

  public forceRender(): void {
    if (!this._initialized) {
      console.warn(
        "[IgniteElement] Attempted to force render before initialization."
      );
      return;
    }

    if (!this._isActive) {
      console.warn("[IgniteElement] Attempted to force render while inactive.");
      return;
    }

    this.renderTemplate();
  }

  get currentState(): State {
    return this._currentState;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get adapter(): IgniteAdapter<State, Event> | undefined {
    return this._adapter;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set initialized(value: boolean) {
    this._initialized = value;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }

  set currentState(state: State) {
    this._currentState = state;
  }
}
