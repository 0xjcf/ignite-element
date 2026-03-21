import "../internal/setupDomPolyfill";

import { createLitRenderStrategy } from "./LitRenderStrategy";
import { registerRenderStrategy } from "./registry";

registerRenderStrategy("lit", createLitRenderStrategy);

export { createLitRenderStrategy } from "./LitRenderStrategy";
