import type { TemplateResult } from "lit-html";
import { render } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import { StateScope } from "./IgniteAdapter";
import injectStyles from "./injectStyles";

export default abstract class IgniteElement<State, Event> extends HTMLElement {
	private _adapter: IgniteAdapter<State, Event> | undefined;
	private _shadowRoot: ShadowRoot;
	private _currentState!: State;
	private _initialized = false;
	private _isActive = false;
	private _unsubscribe: (() => void) | undefined;
	private _sendListener: ((event: globalThis.Event) => void) | undefined;

	constructor(adapter: IgniteAdapter<State, Event>) {
		super();
		this._shadowRoot = this.attachShadow({ mode: "open" });

		injectStyles(this._shadowRoot);

		this._adapter = adapter;
		this.subscribeToAdapter();

		this._currentState = this._adapter.getState();
		this._initialized = true;
	}

	connectedCallback(): void {
		if (!this._unsubscribe && this._adapter) {
			this.subscribeToAdapter();
			this._currentState = this._adapter.getState();
		}

		this._isActive = true;
		if (!this._sendListener) {
			this._sendListener = (event: globalThis.Event) => this.send(event);
		}
		this.addEventListener("send", this._sendListener as EventListener);
		this.renderTemplate();
	}

	disconnectedCallback(): void {
		this._isActive = false;
		if (this._sendListener) {
			this.removeEventListener("send", this._sendListener as EventListener);
		}

		this._unsubscribe?.();
		this._unsubscribe = undefined;

		if (this._adapter && this._adapter.scope !== StateScope.Shared) {
			this._adapter.stop();
			this._adapter = undefined;
		}
	}

	protected send<AdapterEvent>(event: AdapterEvent): void {
		if (!this._isActive || !this._adapter) {
			console.warn("[IgniteElement] Cannot send events while inactive.");
			return;
		}

		const action =
			event instanceof CustomEvent && event.detail ? event.detail : event;
		this._adapter?.send(action);
	}

	private renderTemplate(): void {
		if (!this._isActive || !this._currentState) {
			console.warn(`[IgniteElement] State is not initialized`);
			return;
		}

		render(
			this.render({
				state: this._currentState,
				send: (event: Event) => this.send(event),
			}),
			this._shadowRoot,
		);
	}

	protected abstract render(props: {
		state: State;
		send: (event: Event) => void;
	}): TemplateResult;

	public forceRender(): void {
		if (!this._initialized) {
			console.warn(
				"[IgniteElement] Attempted to force render before initialization.",
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

	private subscribeToAdapter(): void {
		if (!this._adapter) {
			return;
		}

		const subscription = this._adapter.subscribe((state) => {
			this._currentState = state;
			if (this._isActive) {
				this.renderTemplate();
			}
		});

		this._unsubscribe = () => {
			subscription.unsubscribe();
			this._unsubscribe = undefined;
		};
	}
}
