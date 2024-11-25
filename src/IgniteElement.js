import { render } from "lit-html";
export class IgniteElement extends HTMLElement {
    constructor(adapter) {
        super();
        Object.defineProperty(this, "_adapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_shadowRoot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_currentState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_unsubscribe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._adapter = adapter;
        this._shadowRoot = this.attachShadow({ mode: "open" });
        this._currentState = this._adapter.getState();
    }
    connectedCallback() {
        const subscription = this._adapter.subscribe((state) => {
            this._currentState = state;
            this.renderTemplate();
        });
        this._unsubscribe = subscription.unsubscribe;
        this.renderTemplate(); // initial render
    }
    disconnectedCallback() {
        // cleanup is handled within the adapters
        if (this._unsubscribe)
            this._unsubscribe();
        this._adapter.stop();
    }
    send(event) {
        this._adapter.send(event);
    }
    get state() {
        return this._adapter.getState();
    }
    renderTemplate() {
        if (!this._currentState) {
            console.warn(`[IgniteElement] State is not initialized`);
            return;
        }
        render(this.render(), this._shadowRoot);
    }
}
