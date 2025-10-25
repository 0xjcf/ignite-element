import injectStyles from "../../injectStyles";
import type { RenderStrategy } from "../RenderStrategy";
import { mountIgniteJsx } from "./renderer";
import type { IgniteJsxChild } from "./types";

class IgniteJsxRenderStrategy implements RenderStrategy<IgniteJsxChild> {
	private contentRoot: HTMLElement | null = null;

	attach(host: ShadowRoot): void {
		injectStyles(host);
		const existingRoot = host.querySelector<HTMLElement>(
			"[data-ignite-jsx-root]",
		);
		if (existingRoot) {
			this.contentRoot = existingRoot;
			return;
		}

		const root = document.createElement("ignite-jsx-root");
		root.setAttribute("data-ignite-jsx-root", "");
		host.appendChild(root);
		this.contentRoot = root;
	}

	render(view: IgniteJsxChild): void {
		if (!this.contentRoot) {
			throw new Error(
				"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		mountIgniteJsx(this.contentRoot, view);
	}

	detach(): void {
		if (this.contentRoot?.parentNode) {
			this.contentRoot.parentNode.removeChild(this.contentRoot);
		}
		this.contentRoot = null;
	}
}

export const createIgniteJsxRenderStrategy = () =>
	new IgniteJsxRenderStrategy();

export type { IgniteJsxChild };
