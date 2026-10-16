import { afterEach, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

afterEach(() => {
	document.body.replaceChildren();
});

function attachStrategy() {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	return { shadow, strategy };
}

// Attribute order is not state, so attributes are sorted.
function describeNode(node: Node): string {
	if (!(node instanceof Element)) return node.textContent ?? "";
	const attributes = Array.from(node.attributes)
		.map((attribute) => `${attribute.name}=${attribute.value}`)
		.sort();
	const children = Array.from(node.childNodes).map(describeNode).join("");
	return `<${node.localName} ${attributes.join(" ")}>${children}</>`;
}

function snapshot(root: ParentNode): string {
	const content = root.querySelector("ignite-jsx-root");
	return content ? describeNode(content) : "";
}

function freshSnapshot(view: IgniteJsxChild): string {
	const { strategy, shadow } = attachStrategy();
	strategy.render(view);
	return snapshot(shadow);
}

describe("render commit ordering", () => {
	it("a render started from a ref callback does not leave a stale previous tree", () => {
		const { strategy, shadow } = attachStrategy();
		const inner = jsx("div", { "data-b": "2" });
		let reentered = false;
		strategy.render(
			jsx("div", {
				"data-a": "1",
				title: "x",
				ref: () => {
					if (reentered) return;
					reentered = true;
					strategy.render(inner);
				},
			}),
		);
		expect(snapshot(shadow)).toBe(freshSnapshot(inner));

		const final = jsx("div", { "data-a": "1", title: "x", "data-b": "2" });
		strategy.render(final);
		expect(snapshot(shadow)).toBe(freshSnapshot(final));
	});

	it("a reentrant update from a ref during a diff render converges on the newest view", () => {
		const { strategy, shadow } = attachStrategy();
		strategy.render(jsx("div", { "data-a": "1" }));
		let reentered = false;
		const newest = jsx("div", { "data-c": "3" });
		strategy.render(
			jsx("div", {
				"data-a": "1",
				"data-b": "2",
				ref: () => {
					if (reentered) return;
					reentered = true;
					strategy.render(newest);
				},
			}),
		);
		expect(snapshot(shadow)).toBe(freshSnapshot(newest));
		const final = jsx("div", { "data-a": "1", "data-b": "2", "data-c": "3" });
		strategy.render(final);
		expect(snapshot(shadow)).toBe(freshSnapshot(final));
	});
});
