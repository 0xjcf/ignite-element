import { type GlobalStyles, setGlobalStyles } from "./globalStyles";

/**
 * Public configuration shape. Additional options can be added in future phases.
 */
export interface IgniteConfig {
	globalStyles?: GlobalStyles;
}

const CONFIG_SYMBOL = Symbol.for("ignite-element.config");

type ConfigRegistry = {
	[CONFIG_SYMBOL]?: IgniteConfig;
};

const registry = globalThis as typeof globalThis & ConfigRegistry;

function normalizeConfig(config: IgniteConfig): IgniteConfig {
	const normalized: IgniteConfig = {};

	if ("globalStyles" in config) {
		normalized.globalStyles = config.globalStyles;
	}

	return normalized;
}

export function defineIgniteConfig(config: IgniteConfig): IgniteConfig {
	const normalized = normalizeConfig(config);
	registry[CONFIG_SYMBOL] = normalized;

	if ("globalStyles" in normalized) {
		setGlobalStyles(normalized.globalStyles);
	}

	return normalized;
}

export function getIgniteConfig(): IgniteConfig | undefined {
	return registry[CONFIG_SYMBOL];
}
