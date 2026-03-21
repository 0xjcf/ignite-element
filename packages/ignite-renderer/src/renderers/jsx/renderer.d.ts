import { type IgniteJsxChild, type IgniteJsxProps } from "./types";
type NormalizedNode = {
    kind: "element";
    tag: string;
    props: IgniteJsxProps;
    children: NormalizedNode[];
    namespace?: string;
} | {
    kind: "text";
    value: string;
} | {
    kind: "comment";
    comment?: string;
};
export declare function createDomNode(node: IgniteJsxChild, namespace?: string): Node | DocumentFragment;
export declare function mountIgniteJsx(host: (Node & ParentNode) | ShadowRoot, view: IgniteJsxChild): NormalizedNode[];
type RenderOptions = {
    mode?: "diff" | "replace";
    onFallbackReplace?: (reason: string) => void;
};
export declare function renderIgniteJsx(host: (Node & ParentNode) | ShadowRoot, view: IgniteJsxChild, previous?: NormalizedNode[], options?: RenderOptions): NormalizedNode[];
export type { NormalizedNode };
//# sourceMappingURL=renderer.d.ts.map