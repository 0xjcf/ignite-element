import type { RenderStrategy } from "./RenderStrategy";
import {
	getRegisteredRenderStrategies,
	resolveRenderStrategy,
} from "./registry";

const LIT_TEMPLATE_BRAND = "_$litType$";

/**
 * lit-html marks every `TemplateResult` with the `_$litType$` brand. A view's
 * output is therefore self-identifying — exactly as an ignite-jsx view object is
 * — so the renderer can be chosen from what a view returns, with no config.
 */
export function isLitTemplateResult(view: unknown): boolean {
	return (
		typeof view === "object" && view !== null && LIT_TEMPLATE_BRAND in view
	);
}

/**
 * The config-free default render strategy. It eagerly attaches `ignite-jsx` (so
 * the common case is byte-identical to selecting ignite-jsx directly) and
 * switches to the `lit` strategy the moment a view returns a lit `TemplateResult`
 * AND the lit strategy is registered — so a `html\`…\`` view renders with no
 * `ignite.config.ts`, no build plugin, and no pragma, as long as
 * `ignite-element/renderers/lit` is imported.
 *
 * If a lit `TemplateResult` is returned but the lit strategy is NOT registered,
 * it falls back to `ignite-jsx` (the pre-existing behavior) rather than throwing,
 * so components that author throwaway lit views without selecting lit are
 * unaffected. An explicit `renderer` in `ignite.config.ts` bypasses auto-detect
 * entirely (see `resolveConfiguredRenderStrategy`).
 */
export class AutoDetectRenderStrategy implements RenderStrategy<unknown> {
	private host: ShadowRoot | null = null;
	private delegate: RenderStrategy<unknown> | null = null;
	private renderer: string | null = null;

	attach(host: ShadowRoot): void {
		this.host = host;
		this.useRenderer("ignite-jsx");
	}

	render(view: unknown): void {
		const wanted =
			isLitTemplateResult(view) &&
			getRegisteredRenderStrategies().includes("lit")
				? "lit"
				: "ignite-jsx";
		if (wanted !== this.renderer) {
			this.useRenderer(wanted);
		}
		this.delegate?.render(view);
	}

	detach(): void {
		this.delegate?.detach?.();
		this.delegate = null;
		this.renderer = null;
	}

	private useRenderer(renderer: string): void {
		this.delegate?.detach?.();
		const next = resolveRenderStrategy(renderer)() as RenderStrategy<unknown>;
		if (this.host) {
			next.attach(this.host);
		}
		this.delegate = next;
		this.renderer = renderer;
	}
}

export const createAutoDetectRenderStrategy = (): RenderStrategy<unknown> =>
	new AutoDetectRenderStrategy();
