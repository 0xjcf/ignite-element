import type { RenderStrategyFactory } from "./RenderStrategy";

type RenderStrategyRegistry = Map<string, RenderStrategyFactory<unknown>>;

const REGISTRY_SYMBOL = Symbol.for("ignite-renderer.renderStrategyRegistry");

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

export function resolveRenderStrategy(
	renderer: string,
): RenderStrategyFactory<unknown> {
	const registry = getRegistry();
	const registered = registry.get(renderer);

	if (registered) {
		return registered;
	}

	const igniteJsxFallback = registry.get("ignite-jsx");
	let fallbackName: string | undefined;
	let fallbackFactory: RenderStrategyFactory<unknown> | undefined;

	if (igniteJsxFallback) {
		fallbackName = "ignite-jsx";
		fallbackFactory = igniteJsxFallback;
	} else {
		const fallbackEntry = registry.entries().next().value as
			| [string, RenderStrategyFactory<unknown>]
			| undefined;
		if (fallbackEntry) {
			[fallbackName, fallbackFactory] = fallbackEntry;
		}
	}

	if (!fallbackName || !fallbackFactory) {
		throw new Error(
			'[ignite-renderer] No render strategies have been registered. Import "ignite-renderer/jsx" (or another strategy entry point) before registering components.',
		);
	}

	if (renderer !== "ignite-jsx") {
		console.warn(
			`[ignite-renderer] Render strategy "${renderer}" is not registered. Ensure you import "ignite-renderer/${renderer}" before registering components. Falling back to "${fallbackName}".`,
		);
	}

	return fallbackFactory;
}

export function clearRegisteredRenderStrategiesForTests(): void {
	const registry = getRegistry();
	registry.clear();
}

export function getRegisteredRenderStrategies(): string[] {
	return [...getRegistry().keys()];
}
