import type { RenderStrategyFactory } from "./RenderStrategy";
export declare function registerRenderStrategy(renderer: string, factory: RenderStrategyFactory<unknown>): void;
export declare function resolveRenderStrategy(renderer: string): RenderStrategyFactory<unknown>;
export declare function clearRegisteredRenderStrategiesForTests(): void;
export declare function getRegisteredRenderStrategies(): string[];
//# sourceMappingURL=registry.d.ts.map