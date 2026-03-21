import "../internal/setupDomPolyfill";

import { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
import { registerRenderStrategy } from "./registry";

registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);

export { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
export type { IgniteJsxChild } from "./jsx/types";
