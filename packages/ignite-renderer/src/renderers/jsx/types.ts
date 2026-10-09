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

type IgniteRefCallback<T extends Element> = {
	bivarianceHack(node: T | null): void | (() => void | PromiseLike<void>);
}["bivarianceHack"];

type IgniteTagProps<T extends Element> = {
	ref?: IgniteRefCallback<T>;
	/** Names a core host. Not copied to the DOM. */
	use?: string;
	children?: IgniteJsxChild;
	[attribute: string]: unknown;
};

type IgniteKnownTags = {
	[Tag in keyof HTMLElementTagNameMap]: IgniteTagProps<
		HTMLElementTagNameMap[Tag]
	>;
} & {
	[Tag in Exclude<
		keyof SVGElementTagNameMap,
		keyof HTMLElementTagNameMap
	>]: IgniteTagProps<SVGElementTagNameMap[Tag]>;
};

export namespace JSX {
	export type Element = IgniteJsxElement;
	export interface ElementClass {
		render: (...args: unknown[]) => IgniteJsxChild;
	}
	export interface ElementAttributesProperty {
		props: IgniteJsxProps;
	}
	export interface ElementChildrenAttribute {
		children: IgniteJsxChild;
	}
	export interface IntrinsicAttributes {
		key?: string | number | null;
	}
	export interface IntrinsicElements extends IgniteKnownTags {
		[element: string]: IgniteTagProps<globalThis.Element>;
	}
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
