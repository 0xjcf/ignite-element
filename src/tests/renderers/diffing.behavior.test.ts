import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearNoDiffDenylistForTests,
	registerNoDiffDenylistTag,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
} from "../../renderers/jsx/renderer";

describe("ignite-jsx diffing behavior", () => {
	afterEach(() => {
		clearNoDiffDenylistForTests();
	});

	it("does not rewrite input value when unchanged", () => {
		const setSpy = vi.spyOn(HTMLInputElement.prototype, "value", "set");
		const host = document.createElement("div");
		let tree: NormalizedNode[] | undefined = mountIgniteJsx(
			host,
			jsx("input", { value: "abc" }),
		);

		setSpy.mockClear();
		tree = renderIgniteJsx(host, jsx("input", { value: "abc" }), tree);

		expect(setSpy).not.toHaveBeenCalled();
		setSpy.mockRestore();
	});

	it("skips value updates while composing", () => {
		const host = document.createElement("div");
		const tree = mountIgniteJsx(host, jsx("input", { value: "a" }));
		const input = host.querySelector("input") as HTMLInputElement;
		(input as unknown as { isComposing: boolean }).isComposing = true;

		renderIgniteJsx(host, jsx("input", { value: "b" }), tree);

		expect(input.value).toBe("a");
	});

	it("updates event listeners without stacking", () => {
		const host = document.createElement("div");
		const handlerA = vi.fn();
		const handlerB = vi.fn();

		const tree = mountIgniteJsx(host, jsx("button", { onClick: handlerA }));
		renderIgniteJsx(host, jsx("button", { onClick: handlerB }), tree);

		const button = host.querySelector("button") as HTMLButtonElement;
		button.click();

		expect(handlerA).not.toHaveBeenCalled();
		expect(handlerB).toHaveBeenCalledTimes(1);
	});

	it("preserves textarea selection after prop updates", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, jsx("textarea", { value: "hello world" }));
		const textarea = host.querySelector("textarea") as HTMLTextAreaElement;
		textarea.setSelectionRange(6, 11);

		tree = renderIgniteJsx(
			host,
			jsx("textarea", { value: "hello world" }),
			tree,
		);

		expect(textarea.selectionStart).toBe(6);
		expect(textarea.selectionEnd).toBe(11);
	});

	it("falls back to replace on child reorder", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "A" }),
					jsx("span", { children: "B" }),
				],
			}),
		);
		const fallback = vi.fn();

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "B" }),
					jsx("span", { children: "A" }),
				],
			}),
			tree,
			{ onFallbackReplace: fallback },
		);

		expect(host.textContent).toBe("BA");
		expect(fallback).toHaveBeenCalledWith("child-order-change");
	});

	it("forces replace when tag is denylisted", () => {
		registerNoDiffDenylistTag("deny-tag");
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("deny-tag", { children: jsx("span", { children: "A" }) }),
		);
		const fallback = vi.fn();

		tree = renderIgniteJsx(
			host,
			jsx("deny-tag", { children: jsx("span", { children: "B" }) }),
			tree,
			{ onFallbackReplace: fallback },
		);

		expect(host.textContent).toBe("B");
		expect(fallback).toHaveBeenCalled();
	});

	it("bench: diff vs replace on 50 inputs", () => {
		const hostDiff = document.createElement("div");
		const hostReplace = document.createElement("div");
		const inputs = Array.from({ length: 50 }, (_, i) =>
			jsx("input", { value: `v${i}` }),
		);

		let treeDiff = mountIgniteJsx(hostDiff, jsx("form", { children: inputs }));
		let treeReplace = mountIgniteJsx(
			hostReplace,
			jsx("form", { children: inputs }),
		);

		// simulate updates with minor changes
		const updatedInputs = Array.from({ length: 50 }, (_, i) =>
			jsx("input", { value: `v${i + 1}` }),
		);

		treeDiff = renderIgniteJsx(
			hostDiff,
			jsx("form", { children: updatedInputs }),
			treeDiff,
		);
		treeReplace = renderIgniteJsx(
			hostReplace,
			jsx("form", { children: updatedInputs }),
			treeReplace,
			{ mode: "replace" },
		);

		expect(hostDiff.querySelectorAll("input").length).toBe(50);
		expect(hostReplace.querySelectorAll("input").length).toBe(50);
	});
});
