export type IgniteJsxChild =
	| IgniteJsxElement
	| PrimitiveChild
	| IgniteJsxChild[];

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

export const Fragment = Symbol.for("ignite-element.fragment");

export function isIgniteJsxElement(value: unknown): value is IgniteJsxElement {
	return (
		!!value &&
		typeof value === "object" &&
		"type" in (value as Record<string, unknown>) &&
		"props" in (value as Record<string, unknown>)
	);
}

export function normalizeChildren(
	children: IgniteJsxProps["children"],
): IgniteJsxChild[] {
	if (children === undefined || children === null) {
		return [];
	}

	return Array.isArray(children) ? children : [children];
}

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
