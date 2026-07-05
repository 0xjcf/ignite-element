import type { IgniteJsxChild } from "@ignite-element/renderer";
import { IgniteMoveSafeLifecycleElement } from "./IgniteElement";
import { mountIgniteJsxOnce } from "./renderers/ignite-jsx";

export type IgniteShellHost = {
	readonly element: HTMLElement;
	readonly shadowRoot: ShadowRoot;
};

export type IgniteShellTeardown = () => void;

export type IgniteShellConfig = {
	// biome-ignore lint/suspicious/noConfusingVoidType: lifecycle hooks conventionally allow no return or a teardown function.
	onConnect?: (host: IgniteShellHost) => void | IgniteShellTeardown;
};

export type IgniteShellRegistrar = (
	tagName: string,
	render: () => IgniteJsxChild,
) => void;

export function igniteShell(
	config: IgniteShellConfig = {},
): IgniteShellRegistrar {
	return (tagName, render) => {
		if (customElements.get(tagName)) {
			return;
		}

		class IgniteShellElement extends IgniteMoveSafeLifecycleElement {
			private readonly root: ShadowRoot;
			private mounted = false;
			private active = false;
			private teardown: IgniteShellTeardown | undefined;

			constructor() {
				super();
				this.root = this.attachShadow({ mode: "open" });
			}

			connectedCallback(): void {
				this.cancelDisconnectTeardown();

				if (!this.mounted) {
					mountIgniteJsxOnce(this.root, render());
					this.mounted = true;
				}

				if (!this.active) {
					const teardown = config.onConnect?.({
						element: this,
						shadowRoot: this.root,
					});
					this.teardown = typeof teardown === "function" ? teardown : undefined;
					this.active = true;
				}
			}

			disconnectedCallback(): void {
				this.scheduleDisconnectTeardown(() => {
					this.active = false;
					this.teardown?.();
					this.teardown = undefined;
				});
			}
		}

		customElements.define(tagName, IgniteShellElement);
	};
}
