import "./internal/setupDomPolyfill";

export { event, StateScope } from "ignite-core";
export type {
	IgniteConfig,
	IgniteLoggingLevel,
	IgniteRendererId,
	IgniteRenderStrategyId,
} from "ignite-renderer";
export {
	defineIgniteConfig,
	getIgniteConfig,
	setGlobalStyles,
} from "ignite-renderer";
export { loadIgniteConfig } from "./config/loadIgniteConfig";
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
