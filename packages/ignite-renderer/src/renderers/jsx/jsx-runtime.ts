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

// An index signature cannot tell two spellings apart. A fresh props object can.
type HasLiteralKey<Props, Key extends string> = string extends keyof Props
	? false
	: number extends keyof Props
		? false
		: Key extends keyof Props
			? true
			: false;

type BanPair<Props, A extends string, B extends string> = HasLiteralKey<
	Props,
	A
> extends true
	? HasLiteralKey<Props, B> extends true
		? { [K in A | B]: never }
		: unknown
	: unknown;

// Two spellings of one prop are an authoring error. Computed keys are not
// visible here; development builds warn for those.
type DuplicateSpellingBan<Props> = BanPair<
	Props,
	"acceptCharset",
	"accept-charset"
> &
	BanPair<Props, "htmlFor", "for"> &
	BanPair<Props, "onClick", "onclick"> &
	BanPair<Props, "ariaLabel", "aria-label"> &
	BanPair<Props, "className", "class">;

type BanContentProps<Type, Props> = Props extends null | undefined
	? Props
	: [Type] extends [string]
		? Props & UnsupportedContentProps & DuplicateSpellingBan<Props>
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
