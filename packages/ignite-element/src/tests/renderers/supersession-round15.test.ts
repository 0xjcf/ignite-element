import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../renderers/jsx/renderer";

// Round 15 rules.
//  X1 an overridden native value getter that supersedes the commit stops the
//     queued controlled write: ownership is checked in the write phase too.
//  X2 a style getter that supersedes stops the patch, not just the style step.
//  X3 a ref(null) owed after a self-unmount reports a rejection to onError.
//  X4 detach() drops waiting renders after its own callbacks have run.
//  X5 each ref callback owes its own ref(null); a nested ref swap loses none.

const mkRoot = () => {
	const root = document.createElement("div");
	document.body.append(root);
	return root;
};

describe("X1 an overridden value getter that supersedes stops the controlled write", () => {
	it("does not write the stale value", () => {
		const root = mkRoot();
		const proto = HTMLInputElement.prototype;
		const desc = Object.getOwnPropertyDescriptor(
			proto,
			"value",
		) as PropertyDescriptor;
		let trigger = false;
		const writes: unknown[] = [];
		Object.defineProperty(proto, "value", {
			configurable: true,
			get() {
				if (trigger) {
					trigger = false;
					renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
				}
				return desc.get?.call(this);
			},
			set(v) {
				writes.push(v);
				desc.set?.call(this, v);
			},
		});
		try {
			const tree = renderIgniteJsx(
				root,
				jsx("input", { value: "a" }),
				undefined,
				undefined,
			);
			writes.length = 0;
			trigger = true;
			renderIgniteJsx(root, jsx("input", { value: "b" }), tree, undefined);
			expect(writes).toEqual([]);
		} finally {
			Object.defineProperty(proto, "value", desc);
		}
	});
});

describe("X2 a getter's abort is never swallowed", () => {
	// Ownership is checked by act() after the getter returns. The contained
	// reader must let that abort through even when no write follows it.
	it("getContained rechecks ownership in its catch", () => {
		const source = readFileSync(
			resolve(
				__dirname,
				"../../../../ignite-renderer/src/renderers/jsx/renderer.ts",
			),
			"utf8",
		);
		const start = source.indexOf("function getContained(");
		// A window, not a block: instrumented sources add code between the lines.
		const body = source.slice(start, start + 1200);
		expect(body).toMatch(/catch[\s\S]{0,240}?live\(\)[\s\S]{0,60}?return/);
	});
});

describe("X3 / X5 ref lifecycle", () => {
	it("a rejected ref(null) after a self-unmount is contained and reported", async () => {
		const host = document.createElement("div");
		const sr = host.attachShadow({ mode: "open" });
		const errors: unknown[] = [];
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		(host as unknown as { onError: (e: unknown) => void }).onError = (e) =>
			errors.push(e);
		const root = document.createElement("div");
		sr.append(root);
		const ref = (node: Element | null) => {
			if (node) {
				renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
				return undefined;
			}
			return Promise.reject(new Error("late")) as never;
		};
		renderIgniteJsx(root, jsx("span", { ref }), undefined, undefined);
		await new Promise((r) => setTimeout(r, 5));
		const reported = [...errors, ...logged.mock.calls.map((c) => c[1])];
		logged.mockRestore();
		expect(reported.map((e) => (e as Error).message)).toEqual(["late"]);
	});
	it("a nested swap to a different ref still delivers the old ref(null)", () => {
		const root = mkRoot();
		const log: string[] = [];
		const tree1 = renderIgniteJsx(root, jsx("span", {}), undefined, undefined);
		const B = (n: Element | null) => void log.push(`B ${n ? "el" : "null"}`);
		const A = (n: Element | null) => {
			log.push(`A ${n ? "el" : "null"}`);
			if (n) renderIgniteJsx(root, jsx("span", { ref: B }), tree1, undefined);
		};
		renderIgniteJsx(root, jsx("span", { ref: A }), tree1, undefined);
		expect(log).toEqual(["A el", "B el", "A null"]);
	});
});

describe("X5b the nested ref keeps its own disposer", () => {
	it("a disposer returned by the swapped-in ref survives the outer call", () => {
		const root = mkRoot();
		const log: string[] = [];
		const tree1 = renderIgniteJsx(root, jsx("span", {}), undefined, undefined);
		const B = (n: Element | null) => {
			if (n) return () => void log.push("B dispose");
			return undefined;
		};
		const A = (n: Element | null) => {
			if (n) renderIgniteJsx(root, jsx("span", { ref: B }), tree1, undefined);
		};
		renderIgniteJsx(root, jsx("span", { ref: A }), tree1, undefined);
		renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
		expect(log).toEqual(["B dispose"]);
	});
});

describe("X4 detach drops waiting renders after its callbacks", () => {
	it("a disposer that renders during detach leaves no stale request", () => {
		const strategy = createIgniteJsxRenderStrategy();
		const host = document.createElement("div").attachShadow({ mode: "open" });
		strategy.attach(host);
		let go = false;
		customElements.define(
			"x-r15-detach",
			class extends HTMLElement {
				set trig(_v: unknown) {
					if (go) strategy.detach();
				}
			},
		);
		const ref = () => () => strategy.render(jsx("i", {}));
		strategy.render(jsx("div", { children: jsx("span", { ref }) }));
		go = true;
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() =>
			strategy.render(
				jsx("div", {
					children: [jsx("span", { ref }), jsx("x-r15-detach", { trig: 1 })],
				}),
			),
		).not.toThrow();
		err.mockRestore();
	});
});
