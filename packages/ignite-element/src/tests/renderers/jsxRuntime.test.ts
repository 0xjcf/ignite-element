import { describe, expect, it } from "vitest";
import { Fragment as publicFragment } from "../../renderers/jsx";
import { Fragment, jsx, jsxDEV, jsxs } from "../../renderers/jsx/jsx-runtime";
import type {
	IgniteJsxChild,
	IgniteJsxElement,
} from "../../renderers/jsx/types";

describe("Ignite JSX runtime", () => {
	it("exposes Fragment once through the public JSX renderer barrel", () => {
		expect(publicFragment).toBe(Fragment);
	});

	it("creates elements with normalized children", () => {
		const element = jsxs(
			"div",
			{
				children: ["foo", jsx("span", { children: "bar" })],
			},
			"key-1",
		);

		expect(element.type).toBe("div");
		expect(element.key).toBe("key-1");
		const children = element.props.children as IgniteJsxChild[];
		expect(children).toHaveLength(2);
		expect((children[1] as IgniteJsxElement).type).toBe("span");
	});

	it("handles null props and default key", () => {
		const element = jsx("span", null);
		expect(element.props.children).toEqual([]);
		expect(element.key).toBeNull();
	});

	it("honours Fragment type", () => {
		const fragment = jsxs(Fragment, {
			children: ["a", "b"],
		});

		expect(fragment.type).toBe(Fragment);
		expect((fragment.props.children as IgniteJsxChild[])[0]).toBe("a");
	});

	it("allows content props on function components and rejects them on tags", () => {
		function Label(props: {
			innerHTML?: string;
			outerHTML?: string;
			innerText?: string;
			outerText?: string;
			textContent?: string;
		}): IgniteJsxChild {
			return props.textContent ?? null;
		}

		const caption = jsx(Label, {
			innerHTML: "a",
			outerHTML: "b",
			innerText: "c",
			outerText: "d",
			textContent: "caption",
		});
		const repeated = jsxs(Label, { textContent: "caption" });
		expect(caption.props.textContent).toBe("caption");
		expect(repeated.props.textContent).toBe("caption");

		// @ts-expect-error intrinsic tags reject content props
		jsx("div", { textContent: "no" });
		// @ts-expect-error intrinsic tags reject content props
		jsx("div", { innerHTML: "no" });
		// @ts-expect-error intrinsic tags reject content props
		jsx("div", { outerHTML: "no" });
		// @ts-expect-error intrinsic tags reject content props
		jsx("div", { innerText: "no" });
		// @ts-expect-error intrinsic tags reject content props
		jsxs("div", { outerText: "no" });
	});

	it("rejects two spellings of one prop on an intrinsic tag", () => {
		jsx("form", { acceptCharset: "utf-8" });
		jsx("label", { htmlFor: "name" });
		jsx("button", { onClick: () => undefined });
		jsx("div", { "aria-label": "name" });
		jsx("div", { className: "on" });

		// @ts-expect-error acceptCharset and accept-charset are one prop
		jsx("form", { acceptCharset: "utf-8", "accept-charset": "latin1" });
		// @ts-expect-error htmlFor and for are one prop
		jsx("label", { htmlFor: "name", for: "name" });
		// @ts-expect-error onClick and onclick are one prop
		jsx("button", { onClick: () => undefined, onclick: () => undefined });
		// @ts-expect-error ariaLabel and aria-label are one prop
		jsx("div", { ariaLabel: "name", "aria-label": "name" });
		// @ts-expect-error className and class are one prop
		jsx("div", { className: "on", class: "off" });
	});

	it("supports jsxDEV metadata parameters", () => {
		const element = jsxDEV(
			"button",
			{ children: "Click" },
			"button-key",
			false,
			{ fileName: "example.tsx" },
			this,
		);

		expect(element.key).toBe("button-key");
		expect(element.props.children).toEqual(["Click"]);
	});
});
