import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxElement,
	type IgniteJsxProps,
	normalizeChildren,
} from "./types";

type ElementType = IgniteJsxElement["type"];

function createElement(
	type: ElementType,
	rawProps: IgniteJsxProps | null | undefined,
	key: string | number | null | undefined,
): IgniteJsxElement {
	const props: IgniteJsxProps = rawProps ? { ...rawProps } : {};
	const children = normalizeChildren(props.children);
	props.children = children;

	return {
		type,
		props,
		key: key ?? null,
	};
}

export function jsx(
	type: ElementType,
	props: IgniteJsxProps | null | undefined,
	key?: string | number | null,
): IgniteJsxElement {
	return createElement(type, props, key);
}

export function jsxs(
	type: ElementType,
	props: IgniteJsxProps | null | undefined,
	key?: string | number | null,
): IgniteJsxElement {
	return createElement(type, props, key);
}

export function jsxDEV(
	type: ElementType,
	props: IgniteJsxProps | null | undefined,
	key?: string | number | null,
	isStaticChildren?: boolean,
	source?: unknown,
	self?: unknown,
): IgniteJsxElement {
	void isStaticChildren;
	void source;
	void self;
	return createElement(type, props, key);
}

export { Fragment };
export type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps };
