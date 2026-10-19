import { describe, expect, it, vi } from "vitest";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../ignite-renderer/src/renderers/jsx/renderer";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";

// Round 25 (PR #168).
//  F  a file input's value is never written by the controlled path.
//  R  releaseView() takes no commit while it releases, like detach().
//  X  a failed detach that already removed its root drops it, so attach
//     recreates a root in the shadow tree.
const balanced = (ref: ReturnType<typeof vi.fn>) => {
	const calls = ref.mock.calls.map((c) => c[0]);
	expect(calls.filter((el) => el !== null).length).toBe(
		calls.filter((el) => el === null).length,
	);
};
const attached = () => {
	const host = document.createElement("div");
	document.body.append(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	const root = () =>
		shadow.querySelector("[data-ignite-jsx-root]") as HTMLElement;
	return { shadow, strategy, root };
};

describe("R25 F: file inputs", () => {
	it("a re-render with value='' does not clear the selected file", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const tree = renderIgniteJsx(
			host,
			jsx("input", { type: "file", value: "" }),
		);
		const input = host.querySelector("input") as HTMLInputElement;
		const writes: unknown[] = [];
		Object.defineProperty(input, "value", {
			configurable: true,
			get: () => "C:\\fakepath\\a.txt",
			set: (v: unknown) => writes.push(v),
		});
		renderIgniteJsx(host, jsx("input", { type: "file", value: "" }), tree);
		expect(writes).toEqual([]);
	});
});

describe("R25 R: releaseView", () => {
	const view = (late: () => void) =>
		jsx("div", {
			ref: (el: Element | null) => {
				if (el === null) late();
			},
		});
	it("a ref(null) that calls strategy.render() acquires nothing", () => {
		const { strategy } = attached();
		const escaped = vi.fn();
		strategy.render(view(() => strategy.render(jsx("span", { ref: escaped }))));
		strategy.releaseView();
		balanced(escaped);
	});
	it("a ref(null) that calls mountIgniteJsxOnce on the root acquires nothing", () => {
		const { strategy, root } = attached();
		const escaped = vi.fn();
		strategy.render(
			view(() => mountIgniteJsxOnce(root(), jsx("span", { ref: escaped }))),
		);
		strategy.releaseView();
		balanced(escaped);
	});
	it("the root still renders after the release", () => {
		const { strategy, root } = attached();
		strategy.render(jsx("p", { children: "one" }));
		strategy.releaseView();
		const again = vi.fn();
		strategy.render(jsx("p", { ref: again, children: "two" }));
		expect(root().textContent).toBe("two");
	});
});

describe("R25 X: a detach that removed its root and then threw", () => {
	it("the removed root is dropped, and attach recreates it for the next render", () => {
		const { shadow, strategy, root } = attached();
		strategy.render(jsx("p", { children: "one" }));
		const boom = new Error("removed, then threw");
		const native = shadow.removeChild.bind(shadow);
		shadow.removeChild = <T extends Node>(child: T): T => {
			native(child);
			throw boom;
		};
		expect(() => strategy.detach()).toThrow(boom);
		// The removed root is dropped, not rendered into off-screen.
		expect(() => strategy.render(jsx("p", { children: "lost" }))).toThrow(
			/before attach/,
		);
		strategy.attach(shadow);
		const second = vi.fn();
		strategy.render(jsx("p", { ref: second, children: "two" }));
		expect(root()?.textContent).toBe("two");
		expect(second).toHaveBeenCalledWith(root()?.querySelector("p"));
	});
});

describe("R26 a detach that moved its root elsewhere and then threw", () => {
	it("never renders into the foreign parent; attach recreates the root", () => {
		const { shadow, strategy, root } = attached();
		strategy.render(jsx("p", { children: "one" }));
		const foreign = document.createElement("section");
		document.body.append(foreign);
		const boom = new Error("moved, then threw");
		shadow.removeChild = <T extends Node>(child: T): T => {
			foreign.append(child);
			throw boom;
		};
		expect(() => strategy.detach()).toThrow(boom);
		expect(() => strategy.render(jsx("p", { children: "lost" }))).toThrow(
			/before attach/,
		);
		expect(foreign.textContent).not.toContain("lost");
		strategy.attach(shadow);
		strategy.render(jsx("p", { children: "two" }));
		expect(root()?.textContent).toBe("two");
		expect(foreign.textContent).not.toContain("two");
	});
});
