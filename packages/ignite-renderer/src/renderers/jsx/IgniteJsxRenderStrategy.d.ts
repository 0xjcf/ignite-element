import type { RenderStrategy } from "../RenderStrategy";
import type { IgniteJsxChild } from "./types";
declare class IgniteJsxRenderStrategy implements RenderStrategy<IgniteJsxChild> {
    private contentRoot;
    private previousTree;
    private readonly mode;
    private readonly logging;
    private readonly diffEnabled;
    private forceReplace;
    private forceReplaceReason;
    private normalizeLogging;
    constructor();
    attach(host: ShadowRoot): void;
    render(view: IgniteJsxChild): void;
    detach(): void;
    private getHostTag;
    private logFallback;
}
export declare const createIgniteJsxRenderStrategy: () => IgniteJsxRenderStrategy;
export type { IgniteJsxChild };
export { clearNoDiffDenylistForTests, registerNoDiffDenylistTag, } from "./noDiffDenylist";
//# sourceMappingURL=IgniteJsxRenderStrategy.d.ts.map