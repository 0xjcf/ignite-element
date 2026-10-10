import { registerRenderStrategy } from "@ignite-element/renderer";
import { createIgniteJsxRenderStrategy } from "./hostStrategy.js";

registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);

export { createIgniteJsxRenderStrategy };
