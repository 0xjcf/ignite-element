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
					try {
						mountIgniteJsxOnce(this.root, render());
					} catch (error) {
						console.error(
							`[igniteShell] Initial mount failed for "${tagName}".`,
							error,
						);
						return;
					}
					this.mounted = true;
				}

				if (!this.active) {
					let teardown: undefined | IgniteShellTeardown;
					try {
						teardown = config.onConnect?.({
							element: this,
							shadowRoot: this.root,
						});
					} catch (error) {
						this.teardown = undefined;
						console.error(
							`[igniteShell] onConnect failed for "${tagName}".`,
							error,
						);
						return;
					}
					this.teardown = typeof teardown === "function" ? teardown : undefined;
					this.active = true;
				}
			}

			disconnectedCallback(): void {
				this.scheduleDisconnectTeardown(() => {
					this.active = false;
					const teardown = this.teardown;
					this.teardown = undefined;
					if (!teardown) {
						return;
					}

					try {
						teardown();
					} catch (error) {
						console.error(
							`[igniteShell] Deferred disconnect cleanup failed for "${tagName}".`,
							error,
						);
					}
				});
			}
		}

		customElements.define(tagName, IgniteShellElement);
	};
}
