import { describe, expect, it } from "vitest";
import { Fragment, jsx, jsxDEV, jsxs } from "../../renderers/jsx/jsx-runtime";
import type {
	IgniteJsxChild,
	IgniteJsxElement,
} from "../../renderers/jsx/types";

describe("Ignite JSX runtime", () => {
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
