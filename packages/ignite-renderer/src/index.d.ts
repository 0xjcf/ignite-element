export type { IgniteConfig, IgniteLoggingLevel, IgniteRendererId, IgniteRenderStrategyId, } from "./config";
export { defineIgniteConfig, getIgniteConfig } from "./config";
export { getGlobalStyles, setGlobalStyles } from "./globalStyles";
export type { GlobalStyles } from "./globalStyles";
export { default as injectStyles, flushPendingStyles } from "./injectStyles";
export type { RenderStrategy, RenderStrategyFactory } from "./renderers/RenderStrategy";
export { clearRegisteredRenderStrategiesForTests, getRegisteredRenderStrategies, registerRenderStrategy, resolveRenderStrategy, } from "./renderers/registry";
export type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps, } from "./renderers/jsx/types";
export { Fragment } from "./renderers/jsx/types";
//# sourceMappingURL=index.d.ts.map