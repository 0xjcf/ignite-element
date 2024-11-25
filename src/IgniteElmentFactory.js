import { IgniteElement } from "./IgniteElement";
export default function igniteElementFactory(adapterFactory) {
    let sharedAdapter = null;
    return {
        /**
         * Create a component with shared state
         */
        shared(elementName, renderFn) {
            if (!sharedAdapter) {
                sharedAdapter = adapterFactory();
            }
            class SharedElement extends IgniteElement {
                constructor() {
                    super(sharedAdapter);
                }
                render() {
                    return renderFn(this._currentState, (event) => this.send(event));
                }
            }
            customElements.define(elementName, SharedElement);
        },
        /**
         * Create a component with isolated state
         */
        isolated(elementName, renderFn) {
            class IsolatedElement extends IgniteElement {
                constructor() {
                    const isolatedAdapter = adapterFactory();
                    super(isolatedAdapter);
                    Object.defineProperty(this, "isolatedAdapter", {
                        enumerable: true,
                        configurable: true,
                        writable: true,
                        value: void 0
                    });
                    this.isolatedAdapter = isolatedAdapter;
                }
                render() {
                    return renderFn(this._currentState, (event) => this.send(event));
                }
                disconnectedCallback() {
                    super.disconnectedCallback();
                    this.isolatedAdapter.stop();
                }
            }
            customElements.define(elementName, IsolatedElement);
        },
    };
}
