import { Fragment, type IgniteJsxChild, type IgniteJsxElement, type IgniteJsxProps } from "./types";
type ElementType = IgniteJsxElement["type"];
export declare function jsx(type: ElementType, props: IgniteJsxProps | null | undefined, key?: string | number | null): IgniteJsxElement;
export declare function jsxs(type: ElementType, props: IgniteJsxProps | null | undefined, key?: string | number | null): IgniteJsxElement;
export declare function jsxDEV(type: ElementType, props: IgniteJsxProps | null | undefined, key?: string | number | null, isStaticChildren?: boolean, source?: unknown, self?: unknown): IgniteJsxElement;
export { Fragment };
export type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps };
//# sourceMappingURL=jsx-runtime.d.ts.map