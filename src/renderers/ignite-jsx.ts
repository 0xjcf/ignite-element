import { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
import { registerRenderStrategy } from "./resolveConfiguredRenderStrategy";

registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);

export { createIgniteJsxRenderStrategy } from "./jsx/IgniteJsxRenderStrategy";
export type { IgniteJsxChild } from "./jsx/types";
