import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
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

	describe("a custom setter that renders again", () => {
		class ReenterElement extends HTMLElement {
			static onSet: ((value: unknown) => void) | null = null;
			set trigger(value: unknown) {
				ReenterElement.onSet?.(value);
			}
		}
		beforeAll(() => {
			if (!customElements.get("x-reenter")) {
				customElements.define("x-reenter", ReenterElement);
			}
		});
		afterEach(() => {
			ReenterElement.onSet = null;
		});

		function renderWithReentrantSetter(
			strategy: ReturnType<typeof attachStrategy>["strategy"],
			outer: IgniteJsxChild,
			inner: IgniteJsxChild,
		): void {
			let reentered = false;
			ReenterElement.onSet = () => {
				if (reentered) return;
				reentered = true;
				strategy.render(inner);
			};
			strategy.render(outer);
		}

		it("does not patch the DOM from a stale tree while the outer render is still writing", () => {
			const { strategy, shadow } = attachStrategy();
			strategy.render(jsx("div", { "data-a": "1" }));
			const inner = jsx("div", { "data-c": "3" });
			renderWithReentrantSetter(
				strategy,
				jsx("div", {
					"data-a": "1",
					children: jsx("x-reenter", { trigger: true, "data-b": "2" }),
				}),
				inner,
			);
			expect(snapshot(shadow)).toBe(freshSnapshot(inner));
			const final = jsx("div", { "data-a": "1", "data-c": "3" });
			strategy.render(final);
			expect(snapshot(shadow)).toBe(freshSnapshot(final));
		});

		it("a first mount whose setter renders again converges on the newest view", () => {
			const { strategy, shadow } = attachStrategy();
			const inner = jsx("section", { title: "inner" });
			renderWithReentrantSetter(
				strategy,
				jsx("x-reenter", { trigger: true, "data-b": "2" }),
				inner,
			);
			expect(snapshot(shadow)).toBe(freshSnapshot(inner));
		});

		it("converges on the newest view for any outer and inner props", () => {
			const propsArb = fc.dictionary(
				fc.constantFrom("data-a", "data-b", "data-c", "title"),
				fc.constantFrom("1", "2", "3"),
			);
			fc.assert(
				fc.property(
					fc.option(propsArb, { nil: null }),
					propsArb,
					propsArb,
					(first, outerProps, innerProps) => {
						document.body.replaceChildren();
						const { strategy, shadow } = attachStrategy();
						if (first) strategy.render(jsx("div", first));
						const inner = jsx("div", innerProps);
						renderWithReentrantSetter(
							strategy,
							jsx("div", {
								...outerProps,
								children: jsx("x-reenter", { trigger: true }),
							}),
							inner,
						);
						expect(snapshot(shadow)).toBe(freshSnapshot(inner));
						const final = jsx("div", { ...outerProps, ...innerProps });
						strategy.render(final);
						expect(snapshot(shadow)).toBe(freshSnapshot(final));
					},
				),
				{ seed: 168502, numRuns: 200 },
			);
		});
	});
});
