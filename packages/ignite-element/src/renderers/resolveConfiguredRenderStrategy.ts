import {
	clearRegisteredRenderStrategiesForTests,
	getIgniteConfig,
	getRegisteredRenderStrategies,
	type RenderStrategyFactory,
	registerRenderStrategy,
	resolveRenderStrategy,
} from "ignite-renderer";

export {
	clearRegisteredRenderStrategiesForTests,
	getRegisteredRenderStrategies,
	registerRenderStrategy,
};

export function resolveConfiguredRenderStrategy(): RenderStrategyFactory<unknown> {
	const { renderer: configuredRenderer } = getIgniteConfig() ?? {};
	const renderer = configuredRenderer ?? "ignite-jsx";
	return resolveRenderStrategy(renderer);
}
