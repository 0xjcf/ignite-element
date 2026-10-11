/** @jsxImportSource ../../renderers/jsx */
import type { IgniteJsxElement } from "../../renderers/jsx/types";

function Label(props: {
	innerHTML?: string;
	outerHTML?: string;
	innerText?: string;
	outerText?: string;
	textContent?: string;
}): IgniteJsxElement | null {
	void props.textContent;
	return null;
}

const caption = (
	<Label
		innerHTML="a"
		outerHTML="b"
		innerText="c"
		outerText="d"
		textContent="caption"
	/>
);

// @ts-expect-error intrinsic tags reject content props
const text = <div textContent="no" />;
// @ts-expect-error intrinsic tags reject content props
const html = <div innerHTML="no" />;
// @ts-expect-error intrinsic tags reject content props
const outer = <div outerHTML="no" />;
// @ts-expect-error intrinsic tags reject content props
const inner = <div innerText="no" />;
// @ts-expect-error intrinsic tags reject content props
const outerText = <span outerText="no" />;

export const contentPropBan = { caption, text, html, outer, inner, outerText };
