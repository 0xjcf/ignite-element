import type { TemplateResult } from "lit-html";
import type { RenderStrategy } from "./RenderStrategy";
export declare class LitRenderStrategy implements RenderStrategy<TemplateResult> {
    private host;
    attach(host: ShadowRoot): void;
    render(view: TemplateResult): void;
    detach(): void;
}
export declare const createLitRenderStrategy: () => LitRenderStrategy;
//# sourceMappingURL=LitRenderStrategy.d.ts.map