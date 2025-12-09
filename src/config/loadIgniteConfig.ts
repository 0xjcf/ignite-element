import { defineIgniteConfig, type IgniteConfig } from "../config";
import { flushPendingStyles } from "../injectStyles";

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
		const config = extractConfig(module);
		console.info("[ignite-element] loadIgniteConfig (server)", {
			hasConfig: Boolean(config),
		});
		return config ? defineIgniteConfig(config) : undefined;
	}

	const configModule = await loadConfig();
	const config = extractConfig(configModule);

	if (!config) {
		return undefined;
	}

	const normalized = defineIgniteConfig(config);
	flushPendingStyles();

	const renderer = typeof normalized.renderer === "string"
		? normalized.renderer
		: null;
	const loaderKey = renderer ?? "ignite-jsx";
	const loader = RENDERER_LOADERS[loaderKey];

	if (loader) {
		await loader();
	}

	return normalized;
}
