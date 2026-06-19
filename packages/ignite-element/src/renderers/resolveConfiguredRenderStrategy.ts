import {
	clearRegisteredRenderStrategiesForTests,
	createAutoDetectRenderStrategy,
	getIgniteConfig,
	getRegisteredRenderStrategies,
	type RenderStrategyFactory,
	registerRenderStrategy,
	resolveRenderStrategy,
} from "@ignite-element/renderer";

export {
	clearRegisteredRenderStrategiesForTests,
	createAutoDetectRenderStrategy,
	getRegisteredRenderStrategies,
	registerRenderStrategy,
};

/**
 * Resolve the render-strategy factory for an element.
 *
 * - An explicit `renderer` in `ignite.config.ts` wins (the advanced override).
 * - Otherwise — the config-free default — return the auto-detecting strategy,
 *   which routes a lit `TemplateResult` to the `lit` strategy and everything
 *   else to `ignite-jsx`. See `docs/renderer-selection.md`.
 *
 * The empty-registry case still throws eagerly (the canonical "import a renderer
 * entry point" error) instead of deferring it to first render.
 */
export function resolveConfiguredRenderStrategy(): RenderStrategyFactory<unknown> {
	const { renderer: configuredRenderer } = getIgniteConfig() ?? {};
	if (configuredRenderer) {
		return resolveRenderStrategy(configuredRenderer);
	}
	if (getRegisteredRenderStrategies().length === 0) {
		return resolveRenderStrategy("ignite-jsx");
	}
	return createAutoDetectRenderStrategy;
}
