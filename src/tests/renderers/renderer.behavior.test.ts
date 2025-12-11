import { afterEach, describe, expect, it, vi } from "vitest";
import { Fragment, jsx, jsxs } from "../../renderers/jsx/jsx-runtime";
import {
	clearNoDiffDenylistForTests,
	registerNoDiffDenylistTag,
} from "../../renderers/jsx/noDiffDenylist";
import {
	createDomNode,
	mountIgniteJsx,
	renderIgniteJsx,
} from "../../renderers/jsx/renderer";
import type { IgniteJsxProps } from "../../renderers/jsx/types";

describe("renderer core behavior", () => {
	afterEach(() => {
		clearNoDiffDenylistForTests();
	});

	it("creates document fragments when given multiple root nodes", () => {
		const fragment = createDomNode([jsx("span", {}), "text"]);
		expect(fragment).toBeInstanceOf(DocumentFragment);
		expect(fragment.childNodes).toHaveLength(2);
	});

	it("creates single nodes without wrapping fragments", () => {
		const node = createDomNode(jsx("div", { id: "one" }));
		expect(node).toBeInstanceOf(HTMLElement);
		expect((node as HTMLElement).id).toBe("one");
	});

	it("normalizes functional component output", () => {
		const host = document.createElement("div");
		const Component = (props: IgniteJsxProps) => {
			const { label } = props as { label?: string };
			return jsx("p", { children: label });
		};

		renderIgniteJsx(host, jsx(Component, { label: "hello" }));
		expect(host.textContent).toBe("hello");
	});

	it("replaces host content when mode is replace or host is empty", () => {
		const host = document.createElement("div");
		host.appendChild(document.createElement("p"));

		const firstTree = renderIgniteJsx(host, "first", undefined, {
			mode: "replace",
		});
		expect(host.textContent).toBe("first");

		renderIgniteJsx(host, "second", firstTree);
		expect(host.textContent).toBe("second");
	});

	it("falls back when children order changes", () => {
		const host = document.createElement("div");
		const onFallbackReplace = vi.fn();
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "A" }),
					jsx("span", { children: "B" }),
				],
			}),
		);

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "B" }),
					jsx("span", { children: "A" }),
				],
			}),
			tree,
			{ onFallbackReplace },
		);

		expect(onFallbackReplace).toHaveBeenCalledWith("child-order-change");
		expect(host.textContent).toBe("BA");
	});

	it("adds missing children and replaces when DOM is out of sync", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, jsx("div", { children: jsx("span", {}) }));
		const div = host.querySelector("div");
		if (!div) throw new Error("expected div host");

		// append branch: add a second child while DOM is intact
		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "kept" }),
					jsx("span", { children: "added" }),
				],
			}),
			tree,
		);
		expect(host.querySelectorAll("span")).toHaveLength(2);

		// simulate external mutation to hit the missing child path
		const firstChild = div.firstChild;
		if (firstChild) {
			div.removeChild(firstChild);
		}

		const updatedTree = renderIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "kept" }),
					jsx("span", { children: "added" }),
				],
			}),
			tree,
		);

		expect(host.querySelectorAll("span")).toHaveLength(2);
		expect(host.textContent).toBe("keptadded");
		// render again to ensure append-only path covers the append branch
		renderIgniteJsx(
			host,
			jsx("div", { children: [jsx("span", { children: "kept" })] }),
			updatedTree,
		);
		expect(host.querySelectorAll("span")).toHaveLength(1);
	});

	it("handles node kind changes and comment nodes", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, "plain");
		expect(host.firstChild?.nodeType).toBe(Node.TEXT_NODE);

		tree = renderIgniteJsx(host, jsx("span", { children: "element" }), tree);
		expect(host.firstChild?.nodeName.toLowerCase()).toBe("span");

		renderIgniteJsx(host, jsxs(Fragment, { children: [null, null] }), tree);
		const comments = Array.from(host.childNodes).filter(
			(node) => node.nodeType === Node.COMMENT_NODE,
		);
		expect(comments).not.toHaveLength(0);

		const commentTree = mountIgniteJsx(host, null);
		renderIgniteJsx(host, undefined, commentTree);
		expect(host.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
	});

	it("repairs when a text node was replaced with an element", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, "abc");
		const first = host.firstChild;
		if (first) {
			host.replaceChild(document.createElement("div"), first);
		}

		tree = renderIgniteJsx(host, "def", tree);
		expect(host.textContent).toBe("def");
	});

	it("returns a comment placeholder for unknown node types", () => {
		const result = createDomNode({} as never);
		expect(result.nodeType).toBe(Node.COMMENT_NODE);
		expect((result as Comment).data).toBe("ignite-unknown");
	});

	it("updates style objects, clears removed properties, and resets string styles", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", { style: { color: "red", fontSize: "10px" } }),
		);
		const div = host.firstElementChild as HTMLDivElement;

		tree = renderIgniteJsx(
			host,
			jsx("div", { style: { color: "blue" } }),
			tree,
		);
		expect(div.style.color).toBe("blue");
		expect(div.style.fontSize).toBe("");

		tree = renderIgniteJsx(host, jsx("div", { style: "opacity: 0.3" }), tree);
		expect(div.getAttribute("style")).toBe("opacity: 0.3;");

		tree = renderIgniteJsx(
			host,
			jsx("div", { style: { backgroundColor: "black" } }),
			tree,
		);
		expect(div.style.backgroundColor).toBe("black");

		tree = renderIgniteJsx(host, jsx("div", { style: null }), tree);
		expect(div.getAttribute("style")).toBe("");

		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(div.getAttribute("style")).toBe("");
	});

	it("updates event listeners and removes stale props/attributes", () => {
		const host = document.createElement("div");
		const handlerA = vi.fn();
		let tree = mountIgniteJsx(
			host,
			jsx("button", { id: "btn", onClick: handlerA, title: "same" }),
		);
		const handlerB = vi.fn();

		tree = renderIgniteJsx(
			host,
			jsx("button", { onClick: handlerB, className: "active", title: "same" }),
			tree,
		);

		const button = host.querySelector("button") as HTMLButtonElement;
		button.click();
		expect(handlerA).not.toHaveBeenCalled();
		expect(handlerB).toHaveBeenCalledTimes(1);
		expect(button.id).toBe("");
		expect(button.hasAttribute("id")).toBe(false);
		expect(button.className).toBe("active");

		tree = renderIgniteJsx(
			host,
			jsx("button", { className: null, disabled: null }),
			tree,
		);
		expect(button.className).toBe("");
		expect(button.hasAttribute("disabled")).toBe(false);

		const inputTree = mountIgniteJsx(host, jsx("input", { value: "x" }));
		const input = host.querySelector("input") as HTMLInputElement;
		(input as HTMLInputElement & { isComposing?: boolean }).isComposing = true;
		renderIgniteJsx(host, jsx("input", { value: "y" }), inputTree);
		expect(input.value).toBe("x");
	});

	it("handles denylisted tags and tag mismatches with fallback replace", () => {
		const host = document.createElement("div");
		registerNoDiffDenylistTag("deny-tag");
		let tree = mountIgniteJsx(host, jsx("deny-tag", { children: "a" }));

		const fallback = vi.fn();
		tree = renderIgniteJsx(host, jsx("deny-tag", { children: "b" }), tree, {
			onFallbackReplace: fallback,
		});
		expect(fallback).toHaveBeenCalledWith("denylist:deny-tag");
		expect(host.textContent).toBe("b");

		const tagHost = document.createElement("div");
		let tagTree = mountIgniteJsx(tagHost, jsx("p", { children: "p" }));
		const domChild = tagHost.firstChild as Element;
		const span = document.createElement("span");
		span.textContent = "mutated";
		tagHost.replaceChild(span, domChild);

		tagTree = renderIgniteJsx(
			tagHost,
			jsx("p", { children: "restored" }),
			tagTree,
		);
		expect(tagHost.textContent).toBe("restored");
	});

	it("fingerprints comment nodes during append-only compatibility checks", () => {
		const host = document.createElement("div");
		const tree = mountIgniteJsx(
			host,
			jsxs(Fragment, { children: [null, null] }),
		);

		const fallback = vi.fn();
		renderIgniteJsx(
			host,
			jsxs(Fragment, { children: [undefined, null] }),
			tree,
			{ onFallbackReplace: fallback },
		);

		// No fallback because multiset is the same even with comment fingerprints
		expect(fallback).not.toHaveBeenCalled();
		expect(host.childNodes.length).toBeGreaterThan(0);
	});

	it("normalizes SVG attribute names across cases", () => {
		const host = document.createElement("div");
		renderIgniteJsx(
			host,
			jsx("svg", {
				viewBox: "0 0 10 10",
				"stroke-width": "2",
				dataFoo: "bar",
				strokeWidth: 3,
				ariaLabel: "chart",
			}),
		);

		const svg = host.querySelector("svg") as SVGElement;
		expect(svg.getAttribute("viewBox")).toBe("0 0 10 10");
		expect(svg.getAttribute("stroke-width")).toBe("3");
		expect(svg.getAttribute("data-foo")).toBe("bar");
		expect(svg.getAttribute("aria-label")).toBe("chart");
	});
});
