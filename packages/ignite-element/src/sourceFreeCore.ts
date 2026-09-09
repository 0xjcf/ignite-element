import type { IgniteJsxChild } from "@ignite-element/renderer";
import { mountIgniteJsxOnce } from "@ignite-element/renderer/jsx";
import { IgniteMoveSafeLifecycleElement } from "./IgniteElement";

/** Register static JSX components without a source or public lifecycle hooks. */
export function igniteCore(
	...args: [config?: Record<PropertyKey, never>]
): (tagName: string, render: () => IgniteJsxChild) => void {
	const [config] = args;
	if (
		args.length > 1 ||
		(config !== undefined &&
			(typeof config !== "object" ||
				config === null ||
				Object.getPrototypeOf(config) !== Object.prototype ||
				Reflect.ownKeys(config).length !== 0))
	) {
		throw new TypeError(
			"[igniteCore] Invalid source-free configuration. Use igniteCore(), undefined, or an empty plain object. Source options belong to an adapter entrypoint; presentation lifecycle hooks are not supported.",
		);
	}

	return (tagName, render) => {
		if (customElements.get(tagName)) return;

		class SourceFreeElement extends IgniteMoveSafeLifecycleElement {
			private readonly root = this.attachShadow({ mode: "open" });
			private mounted = false;

			connectedCallback(): void {
				this.cancelDisconnectTeardown();
				if (this.mounted) return;
				try {
					mountIgniteJsxOnce(this.root, render());
					this.mounted = true;
				} catch (error) {
					console.error(
						`[igniteCore] Initial source-free mount failed for "${tagName}".`,
						error,
					);
				}
			}
		}

		customElements.define(tagName, SourceFreeElement);
	};
}
