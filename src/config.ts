import { type GlobalStyles, setGlobalStyles } from "./globalStyles";

export type IgniteRendererId = "lit" | "ignite-jsx";
export type IgniteRenderStrategyId = "diff" | "replace" | (string & {});
export type IgniteLoggingLevel = "off" | "warn" | "debug" | (string & {});

/**
 * Public configuration shape. Additional options can be added in future phases.
 * `globalStyles` remains as a deprecated alias for `styles` during migration.
 */
export interface IgniteConfig {
	styles?: GlobalStyles;
	renderer?: IgniteRendererId;
	strategy?: IgniteRenderStrategyId;
	logging?: IgniteLoggingLevel;
	/** @deprecated Use `styles` instead. */
	globalStyles?: GlobalStyles;
}

const CONFIG_SYMBOL = Symbol.for("ignite-element.config");

type ConfigRegistry = {
	[CONFIG_SYMBOL]?: IgniteConfig;
};

const registry = globalThis as typeof globalThis & ConfigRegistry;

function normalizeConfig(config: IgniteConfig): IgniteConfig {
	const normalized: IgniteConfig = {};

	const hasStyles = "styles" in config;
	const hasDeprecatedGlobalStyles = "globalStyles" in config;
	const styles = hasStyles
		? config.styles
		: hasDeprecatedGlobalStyles
			? config.globalStyles
			: undefined;

	if (styles !== undefined) {
		if (!hasStyles && hasDeprecatedGlobalStyles) {
			console.warn(
				"[ignite-element] `globalStyles` is deprecated. Use `styles` in ignite.config instead.",
			);
		}
		normalized.styles = styles;
	}

	if ("renderer" in config) {
		const renderer = config.renderer;
		if (renderer === "lit" || renderer === "ignite-jsx") {
			normalized.renderer = renderer;
		} else {
			console.warn(
				`[ignite-element] Unknown renderer "${String(
					renderer,
				)}" in ignite.config. Supported values are "lit" and "ignite-jsx". Falling back to "lit".`,
			);
			normalized.renderer = "lit";
		}
	}

	if ("strategy" in config) {
		normalized.strategy = config.strategy;
	}

	if ("logging" in config) {
		normalized.logging = config.logging;
	}

	return normalized;
}

export function defineIgniteConfig(config: IgniteConfig): IgniteConfig {
	const normalized = normalizeConfig(config);
	registry[CONFIG_SYMBOL] = normalized;

	if ("styles" in normalized) {
		setGlobalStyles(normalized.styles);
	}

	return normalized;
}

export function getIgniteConfig(): IgniteConfig | undefined {
	return registry[CONFIG_SYMBOL];
}
