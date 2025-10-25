import { getIgniteConfig } from "../config";
import { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
import { createLitRenderStrategy } from "./LitRenderStrategy";
import type { RenderStrategyFactory } from "./RenderStrategy";

const STRATEGY_FACTORIES: Record<string, RenderStrategyFactory<unknown>> = {
	lit: createLitRenderStrategy,
	"ignite-jsx": createIgniteJsxRenderStrategy,
};

export function resolveConfiguredRenderStrategy(): RenderStrategyFactory<unknown> {
	const renderer = getIgniteConfig()?.renderer ?? "ignite-jsx";
	const factory = STRATEGY_FACTORIES[renderer];
	if (!factory) {
		console.warn(
			`[ignite-element] Unknown renderer "${renderer}" in ignite.config. Falling back to "lit".`,
		);
		return STRATEGY_FACTORIES.lit;
	}

	return factory;
}
