import "./internal/setupDomPolyfill";

export type {
	IgniteConfig,
	IgniteLoggingLevel,
	IgniteRendererId,
	IgniteRenderStrategyId,
} from "./config";
export { defineIgniteConfig, getIgniteConfig } from "./config";
export { loadIgniteConfig } from "./config/loadIgniteConfig";
export { event } from "./events";
export { setGlobalStyles } from "./globalStyles";
export { StateScope } from "./IgniteAdapter";
export {
	type AdapterPack,
	type BaseRenderArgs as IgniteRenderArgs,
	type ComponentFactory,
	default as igniteElementFactory,
} from "./IgniteElementFactory";
export type { RenderArgs } from "./RenderArgs";
export {
	registerRenderStrategy,
	resolveConfiguredRenderStrategy,
} from "./renderers/resolveConfiguredRenderStrategy";
