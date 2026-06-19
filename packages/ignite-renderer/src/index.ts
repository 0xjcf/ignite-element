// Public surface of `@ignite-element/renderer`. This package is the advanced/
// legacy entry: ordinary v3 apps use `ignite-element` + the JSX path and never
// import from here. The split below is intentional (see
// .fas/memory/decisions.md, 2026-06-04):
//   - Advanced-public: defineIgniteConfig/getIgniteConfig, the JSX types and
//     Fragment, and the render-strategy registry (register/resolve/list).
//   - Internal (@internal): get/setGlobalStyles, injectStyles/flushPendingStyles,
//     and clearRegisteredRenderStrategiesForTests. They stay exported only for
//     internal cross-package use, not as a supported API.
export type {
	IgniteConfig,
	IgniteLoggingLevel,
	IgniteRendererId,
	IgniteRenderStrategyId,
} from "./config";
export { defineIgniteConfig, getIgniteConfig } from "./config";
export type { GlobalStyles } from "./globalStyles";
export { getGlobalStyles, setGlobalStyles } from "./globalStyles";
export { default as injectStyles, flushPendingStyles } from "./injectStyles";
export {
	AutoDetectRenderStrategy,
	createAutoDetectRenderStrategy,
	isLitTemplateResult,
} from "./renderers/AutoDetectRenderStrategy";
export type {
	IgniteJsxChild,
	IgniteJsxElement,
	IgniteJsxProps,
} from "./renderers/jsx/types";
export { Fragment } from "./renderers/jsx/types";
export type {
	RenderStrategy,
	RenderStrategyFactory,
} from "./renderers/RenderStrategy";
export {
	clearRegisteredRenderStrategiesForTests,
	getRegisteredRenderStrategies,
	registerRenderStrategy,
	resolveRenderStrategy,
} from "./renderers/registry";
