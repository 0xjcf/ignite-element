export { default as createMobXAdapter } from "./adapters/MobxAdapter";
export { default as createReduxAdapter } from "./adapters/ReduxAdapter";
export { default as createXStateAdapter } from "./adapters/XStateAdapter";
export { setGlobalStyles } from "./globalStyles";
export { StateScope } from "./IgniteAdapter";
export { igniteCore } from "./IgniteCore";
export {
	type BaseRenderArgs as IgniteRenderArgs,
	type ComponentFactory,
	default as igniteElementFactory,
} from "./IgniteElementFactory";
export type { RenderArgs } from "./RenderArgs";
