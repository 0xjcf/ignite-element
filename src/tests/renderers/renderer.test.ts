import { describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { createDomNode } from "../../renderers/jsx/renderer";
import type {
	IgniteJsxChild,
	IgniteJsxComponent,
} from "../../renderers/jsx/types";

describe("createDomNode", () => {
	it("returns a DocumentFragment when rendering array children", () => {
		const childArray: IgniteJsxChild[] = [
			"hello",
			jsx("span", { children: "world" }),
		];

		const fragment = createDomNode(childArray);

		expect(fragment).toBeInstanceOf(DocumentFragment);
		if (!(fragment instanceof DocumentFragment)) {
			throw new Error("Expected a DocumentFragment");
		}

		const nodes = Array.from(fragment.childNodes);
		expect(nodes).toHaveLength(2);
		expect(nodes[0].textContent).toBe("hello");
		expect(nodes[1]).toBeInstanceOf(HTMLElement);
		expect((nodes[1] as HTMLElement).tagName).toBe("SPAN");
	});

	it("invokes functional component types to produce DOM nodes", () => {
		const MyComponent: IgniteJsxComponent = (props) =>
			jsx("button", { children: props.label as string });

		const element = jsx(MyComponent, { label: "Click me" });
		const node = createDomNode(element);

		expect(node).toBeInstanceOf(HTMLElement);
		if (!(node instanceof HTMLElement)) {
			throw new Error("Expected an HTMLElement");
		}
		expect(node.tagName).toBe("BUTTON");
		expect(node.textContent).toBe("Click me");
	});
});
