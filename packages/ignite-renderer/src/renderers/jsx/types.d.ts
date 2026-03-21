export type IgniteJsxChild = IgniteJsxElement | PrimitiveChild | IgniteJsxChild[];
type PrimitiveChild = string | number | boolean | null | undefined;
export type IgniteJsxComponent = (props: IgniteJsxProps) => IgniteJsxChild;
export interface IgniteJsxProps {
    [key: string]: unknown;
    children?: IgniteJsxChild;
}
export interface IgniteJsxElement {
    type: string | IgniteJsxComponent | typeof Fragment;
    props: IgniteJsxProps;
    key?: string | number | null;
}
export declare const Fragment: unique symbol;
export declare function isIgniteJsxElement(value: unknown): value is IgniteJsxElement;
export declare function normalizeChildren(children: IgniteJsxProps["children"]): IgniteJsxChild[];
declare global {
    namespace JSX {
        type Element = IgniteJsxElement;
        interface ElementClass {
            render: (...args: unknown[]) => IgniteJsxChild;
        }
        interface ElementAttributesProperty {
            props: IgniteJsxProps;
        }
        interface ElementChildrenAttribute {
            children: IgniteJsxChild;
        }
        interface IntrinsicAttributes {
            key?: string | number | null;
        }
        interface IntrinsicElements {
            [element: string]: Record<string, unknown>;
        }
    }
}
export {};
//# sourceMappingURL=types.d.ts.map