import {
	Fragment,
	type IgniteJsxChild,
	type IgniteJsxElement,
	type IgniteJsxProps,
	normalizeChildren,
} from "./types";

type UnsupportedContentProps = {
	innerHTML?: never;
	outerHTML?: never;
	innerText?: never;
	outerText?: never;
	textContent?: never;
};

type BanContentProps<Type, Props> = Props extends null | undefined
	? Props
	: [Type] extends [string]
		? Props & UnsupportedContentProps
		: Props;

type ElementType = IgniteJsxElement["type"];

// `props: never` accepts every function component. Parameter positions are
// checked contravariantly, and `never` is assignable to each props type.
type JsxCallable = (props: never) => IgniteJsxChild;
type JsxType = string | typeof Fragment | JsxCallable;

function createElement(
	type: JsxType,
	rawProps: IgniteJsxProps | null | undefined,
	key: string | number | null | undefined,
): IgniteJsxElement {
	const props: IgniteJsxProps = rawProps ? { ...rawProps } : {};
	const children = normalizeChildren(props.children);
	props.children = children;

	return {
		type: type as ElementType,
		props,
		key: key ?? null,
	};
}

type JsxResult<Props> = IgniteJsxElement &
	(Props extends object ? { readonly props: Props } : Record<never, never>);

export function jsx<
	const Type extends JsxType,
	const Props extends object | null | undefined,
>(
	type: Type,
	props: BanContentProps<Type, Props>,
	key?: string | number | null,
): JsxResult<Props> {
	return createElement(
		type,
		props as IgniteJsxProps | null | undefined,
		key,
	) as JsxResult<Props>;
}

export function jsxs<
	const Type extends JsxType,
	const Props extends object | null | undefined,
>(
	type: Type,
	props: BanContentProps<Type, Props>,
	key?: string | number | null,
): JsxResult<Props> {
	return createElement(
		type,
		props as IgniteJsxProps | null | undefined,
		key,
	) as JsxResult<Props>;
}

export function jsxDEV<
	const Type extends JsxType,
	const Props extends object | null | undefined,
>(
	type: Type,
	props: BanContentProps<Type, Props>,
	key?: string | number | null,
	isStaticChildren?: boolean,
	source?: unknown,
	self?: unknown,
): IgniteJsxElement {
	void isStaticChildren;
	void source;
	void self;
	return createElement(type, props as IgniteJsxProps | null | undefined, key);
}

export type { JSX } from "./types";
export { Fragment };
export type { IgniteJsxChild, IgniteJsxElement, IgniteJsxProps };
