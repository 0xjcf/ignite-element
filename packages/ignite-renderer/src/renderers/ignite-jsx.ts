import { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
import { registerRenderStrategy } from "./registry";

registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);

export type { IgniteHostDefinition, IgniteHostRuntime } from "./jsx/hosts";
export {
	bindIgniteHostRuntime,
	describeIgniteHosts,
	readIgniteHostRuntime,
} from "./jsx/hosts";
export {
	clearNoDiffDenylistForTests,
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
	registerNoDiffDenylistTag,
} from "./jsx/IgniteJsxRenderStrategy";
export { Fragment, jsx, jsxDEV, jsxs } from "./jsx/jsx-runtime";
export {
	reacquireMountedView,
	releaseMountedView,
} from "./jsx/renderer";
export type {
	IgniteJsxChild,
	IgniteJsxComponent,
	IgniteJsxElement,
	IgniteJsxProps,
} from "./jsx/types";
export { isIgniteJsxElement, normalizeChildren } from "./jsx/types";
