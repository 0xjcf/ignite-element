import "./internal/setupDomPolyfill";

export { default as createMobXAdapter } from "./adapters/MobxAdapter";
export { default as createReduxAdapter } from "./adapters/ReduxAdapter";
export type {
	ExtendedState,
	XStateActorInstance,
	XStateCommandActor,
	XStateMachineActor,
	XStateSnapshot,
} from "./adapters/XStateAdapter";
export { default as createXStateAdapter } from "./adapters/XStateAdapter";
export type { IgniteConfig } from "./config";
export {
	defineIgniteConfig,
	getIgniteConfig,
} from "./config";
export { loadIgniteConfig } from "./config/loadIgniteConfig";
export { event } from "./events";
export { setGlobalStyles } from "./globalStyles";
export { StateScope } from "./IgniteAdapter";
export {
	igniteCore,
	igniteCoreMobx,
	igniteCoreRedux,
	igniteCoreXState,
} from "./IgniteCore";
export {
	type AdapterPack,
	type BaseRenderArgs as IgniteRenderArgs,
	type ComponentFactory,
	default as igniteElementFactory,
} from "./IgniteElementFactory";
export {
	type IgniteConfigVitePluginOptions,
	igniteConfigVitePlugin,
} from "./plugins/viteIgniteConfigPlugin";
export {
	IgniteConfigWebpackPlugin,
	type IgniteConfigWebpackPluginOptions,
} from "./plugins/webpackIgniteConfigPlugin";
export type { RenderArgs } from "./RenderArgs";
export {
	registerRenderStrategy,
	resolveConfiguredRenderStrategy,
} from "./renderers/resolveConfiguredRenderStrategy";
