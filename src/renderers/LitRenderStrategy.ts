import type { TemplateResult } from "lit-html";
import { render } from "lit-html";
import injectStyles from "../injectStyles";
import type { RenderStrategy } from "./RenderStrategy";

export class LitRenderStrategy implements RenderStrategy<TemplateResult> {
	private host: ShadowRoot | null = null;

	attach(host: ShadowRoot): void {
		this.host = host;
		injectStyles(host);
	}

	render(view: TemplateResult): void {
		if (!this.host) {
			throw new Error(
				"[LitRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		render(view, this.host);
	}

	detach(): void {
		// lit-html does not require explicit cleanup; host is retained for reconnection
	}
}

export const createLitRenderStrategy = () => new LitRenderStrategy();
