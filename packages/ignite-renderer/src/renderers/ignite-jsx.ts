import "../internal/setupDomPolyfill";

import { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
import { registerRenderStrategy } from "./registry";

registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);

export {
	clearNoDiffDenylistForTests,
	createIgniteJsxRenderStrategy,
	registerNoDiffDenylistTag,
} from "./jsx/IgniteJsxRenderStrategy";
export { Fragment, jsx, jsxDEV, jsxs } from "./jsx/jsx-runtime";
export type {
	IgniteJsxChild,
	IgniteJsxComponent,
	IgniteJsxElement,
	IgniteJsxProps,
} from "./jsx/types";
export { isIgniteJsxElement, normalizeChildren } from "./jsx/types";
