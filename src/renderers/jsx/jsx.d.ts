import type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps } from "./types";

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
			children: { children?: IgniteJsxChild };
		}
		interface IntrinsicAttributes {
			key?: string | number | null;
		}
		interface IntrinsicElements {
			[element: string]: Record<string, unknown>;
		}
	}
}
