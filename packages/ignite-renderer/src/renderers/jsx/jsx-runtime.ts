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

type JsxResult<Props> = IgniteJsxElement &
	(Props extends object ? { readonly props: Props } : Record<never, never>);

export function jsx<const Props extends object | null | undefined>(
	type: ElementType,
	props: Props,
	key?: string | number | null,
): JsxResult<Props> {
	return createElement(
		type,
		props as IgniteJsxProps | null | undefined,
		key,
	) as JsxResult<Props>;
}

export function jsxs<const Props extends object | null | undefined>(
	type: ElementType,
	props: Props,
	key?: string | number | null,
): JsxResult<Props> {
	return createElement(
		type,
		props as IgniteJsxProps | null | undefined,
		key,
	) as JsxResult<Props>;
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

export type { JSX } from "./types";
export { Fragment };
export type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps };
