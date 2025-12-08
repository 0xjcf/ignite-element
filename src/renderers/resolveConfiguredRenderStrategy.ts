import { getIgniteConfig } from "../config";
import type { RenderStrategyFactory } from "./RenderStrategy";

type RenderStrategyRegistry = Map<string, RenderStrategyFactory<unknown>>;

const REGISTRY_SYMBOL = Symbol.for("ignite-element.renderStrategyRegistry");

type RegistryHost = typeof globalThis & {
	[REGISTRY_SYMBOL]?: RenderStrategyRegistry;
};

function getRegistry(): RenderStrategyRegistry {
	const host = globalThis as RegistryHost;
	let registry = host[REGISTRY_SYMBOL];
	if (!registry) {
		registry = new Map<string, RenderStrategyFactory<unknown>>();
		host[REGISTRY_SYMBOL] = registry;
	}
	return registry;
}

export function registerRenderStrategy(
	renderer: string,
	factory: RenderStrategyFactory<unknown>,
): void {
	const registry = getRegistry();
	registry.set(renderer, factory);
}

export function resolveConfiguredRenderStrategy(): RenderStrategyFactory<unknown> {
	const { renderer: configuredRenderer } = getIgniteConfig() ?? {};
	const renderer = configuredRenderer ?? "ignite-jsx";
	const registry = getRegistry();
	const registered = registry.get(renderer);

	if (registered) {
		return registered;
	}

	const fallback = registry.get("ignite-jsx") ?? registry.values().next().value;
	if (!fallback) {
		throw new Error(
			'[ignite-element] No render strategies have been registered. Import "ignite-element/renderers/ignite-jsx" (or another strategy entry point) before registering components.',
		);
	}

	if (renderer !== "ignite-jsx") {
		console.warn(
			`[ignite-element] Render strategy "${renderer}" is not registered. Ensure your config loader imports "ignite-element/renderers/${renderer}" (the official plugins handle this automatically). Falling back to Ignite JSX.`,
		);
	}

	return fallback;
}

export function clearRegisteredRenderStrategiesForTests(): void {
	const registry = getRegistry();
	registry.clear();
}

export function getRegisteredRenderStrategies(): string[] {
	return [...getRegistry().keys()];
}
