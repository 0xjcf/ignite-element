import "../internal/setupDomPolyfill";

import { createLitRenderStrategy } from "./LitRenderStrategy";
import { registerRenderStrategy } from "./resolveConfiguredRenderStrategy";

registerRenderStrategy("lit", createLitRenderStrategy);

export { createLitRenderStrategy } from "./LitRenderStrategy";
