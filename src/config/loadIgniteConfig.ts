import type { IgniteConfig } from "../config";

type ConfigModule =
	| IgniteConfig
	| {
			default?: IgniteConfig;
	  };

type ConfigLoader = () => Promise<ConfigModule>;

type RendererLoader = () => Promise<unknown>;

const RENDERER_LOADERS: Record<string, RendererLoader> = {
	"ignite-jsx": () => import("../renderers/ignite-jsx"),
	lit: () => import("../renderers/lit"),
};

type ConfigWrapper = { default?: IgniteConfig };

function isConfigWrapper(module: ConfigModule): module is ConfigWrapper {
	return Boolean(module) && typeof module === "object" && "default" in module;
}

function isIgniteConfigValue(module: ConfigModule): module is IgniteConfig {
	return (
		Boolean(module) && typeof module === "object" && !("default" in module)
	);
}

function extractConfig(module: ConfigModule): IgniteConfig | undefined {
	if (isConfigWrapper(module)) {
		const candidate = module.default;
		return candidate && typeof candidate === "object" ? candidate : undefined;
	}

	if (isIgniteConfigValue(module)) {
		return module;
	}

	return undefined;
}

export async function loadIgniteConfig(
	loadConfig: ConfigLoader,
): Promise<IgniteConfig | undefined> {
	if (typeof window === "undefined") {
		const module = await loadConfig();
		return extractConfig(module);
	}

	const configModule = await loadConfig();
	const config = extractConfig(configModule);

	if (!config) {
		return undefined;
	}

	const renderer = typeof config.renderer === "string" ? config.renderer : null;
	const loaderKey = renderer ?? "ignite-jsx";
	const loader = RENDERER_LOADERS[loaderKey];

	if (loader) {
		await loader();
	}

	return config;
}
