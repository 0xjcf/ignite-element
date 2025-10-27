import type { IgniteConfig } from "../config";

type ConfigModule =
	| IgniteConfig
	| {
			default?: IgniteConfig;
	  };

type ConfigLoader = () => Promise<ConfigModule>;

type RendererLoader = () => Promise<unknown>;

const RENDERER_LOADERS: Record<string, RendererLoader> = {
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
	const module = await loadConfig();
	const config = extractConfig(module);

	if (!config) {
		return undefined;
	}

	const renderer = config.renderer;
	if (typeof renderer === "string") {
		const loader = RENDERER_LOADERS[renderer];
		if (loader) {
			await loader();
		}
	}

	return config;
}
