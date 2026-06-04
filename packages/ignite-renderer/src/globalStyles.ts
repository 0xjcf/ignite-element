export interface StyleObject {
	href: string;
	integrity?: string;
	crossOrigin?: string;
}

export type GlobalStyles = string | StyleObject | undefined;

let globalStyles: GlobalStyles;

/**
 * @internal Imperative global-style state. The supported public path for shared
 * styles is `defineIgniteConfig({ styles })`; this setter backs it.
 */
export function setGlobalStyles(style: GlobalStyles): void {
	if (Array.isArray(style)) {
		throw new Error(
			"setGlobalStyles does not accept arrays. Provide a single string or StyleObject.",
		);
	}
	globalStyles = style;
}

/** @internal Reads the global-style state set via `defineIgniteConfig`. */
export function getGlobalStyles(): GlobalStyles {
	return globalStyles;
}
