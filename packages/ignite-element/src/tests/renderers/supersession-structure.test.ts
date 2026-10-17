import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { createDomNode } from "../../renderers/jsx/renderer";

// Structural rules (PR #168, round 6). Every DOM write and destructive op
// goes through one guarded helper:
//  S1 a detached root under construction owns its commit from the moment it is
//     created, before any of its setters run.
//  S2 ownership is rechecked between style mutations.
//  S3 a drop clears a pre-upgrade attribute only if the setter left it alone.
//  S4 ownership is rechecked before any destructive op, including after
//     component execution and before an unmount runs cleanups.
//  S6 ownership is rechecked after every write too: the last write's callback
//     may supersede, so no trailing step (append, ref, return) follows it.
//  S5 default* names are preserved on drop only where the element has the
//     native default field.

let hook: ((tag: string) => void) | null = null;
class Own extends HTMLElement {
	set trig(v: unknown) {
		hook?.(`t${String(v)}`);
	}
}
let otherMount: typeof mountIgniteJsxOnce;
beforeAll(async () => {
	customElements.define("x-own", Own);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	hook = null;
	document.body.replaceChildren();
});

const mkStrategy = () => {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	return {
		strategy,
		root: shadow.querySelector("ignite-jsx-root") as HTMLElement,
	};
};

describe("S1 a detached root owns its commit before its setters run", () => {
	it("construction stops after a nested mount on the root element", () => {
		let seen: HTMLElement | null = null;
		class Self extends HTMLElement {
			set trig(_v: unknown) {
				seen = this;
				mountIgniteJsxOnce(this, jsx("p", { "data-m": "1" }));
			}
		}
		customElements.define("x-self", Self);
		const root = createDomNode(
			jsx("x-self", {
				trig: 1,
				children: [
					jsx("b", { children: "old1" }),
					jsx("b", { children: "old2" }),
				],
			}),
		) as HTMLElement;
		expect(seen).toBe(root);
		expect(root.children.length).toBe(1);
		expect(root.firstElementChild?.localName).toBe("p");
	});
});

describe("S2 ownership is rechecked between style mutations", () => {
	it("no style write follows a remount inside the first one", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 2, max: 5 }),
				fc.constantFrom("mount-same", "mount-other", "detach"),
				(n, event) => {
					document.body.replaceChildren();
					const { strategy, root } = mkStrategy();
					const names = Array.from({ length: n }, (_, i) => `--p${i}`);
					const view = (g: number) =>
						jsx("div", {
							style: Object.fromEntries(names.map((k) => [k, `${g}`])),
						});
					strategy.render(view(0));
					const proto = CSSStyleDeclaration.prototype;
					const original = proto.setProperty;
					let fired = false;
					let after = 0;
					proto.setProperty = function (
						this: CSSStyleDeclaration,
						...a: Parameters<typeof original>
					) {
						if (fired) after++;
						const r = original.apply(this, a);
						if (!fired && a[1] === "1") {
							fired = true;
							if (event === "detach") strategy.detach();
							else
								(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
									root,
									jsx("p", {}),
								);
						}
						return r;
					};
					try {
						strategy.render(view(1));
					} finally {
						proto.setProperty = original;
					}
					expect(fired).toBe(true);
					expect(after).toBe(0);
				},
			),
			{ seed: 169302, numRuns: 30 },
		);
	});
});

describe("S3 a dropped own setter keeps what it reflected", () => {
	let uid = 0;
	it("clears the pre-upgrade attribute only when the setter left it alone", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("foo", "bar", "mode"),
				fc.boolean(),
				fc.boolean(),
				(key, reflects, preUpgrade) => {
					const tag = `x-refl${uid++}`;
					const define = () =>
						customElements.define(
							tag,
							class extends HTMLElement {
								constructor() {
									super();
									Object.defineProperty(this, key, {
										configurable: true,
										set: (v) => {
											if (reflects) {
												if (v === undefined) this.setAttribute(key, "default");
												else this.setAttribute(key, String(v));
											}
										},
									});
								}
							},
						);
					const { strategy, root } = mkStrategy();
					if (!preUpgrade) define();
					strategy.render(jsx(tag, { [key]: "x" }));
					if (preUpgrade) {
						define();
						customElements.upgrade(root.firstElementChild as Element);
					}
					strategy.render(jsx(tag, {}));
					const el = root.firstElementChild as Element;
					const fresh = mkStrategy();
					fresh.strategy.render(jsx(tag, {}));
					if (reflects) expect(el.getAttribute(key)).toBe("default");
					else
						expect(el.outerHTML).toBe(fresh.root.firstElementChild?.outerHTML);
				},
			),
			{ seed: 169303, numRuns: 40 },
		);
	});
});

describe("S4 ownership is rechecked after component execution", () => {
	it("a component that mounts on the host before the first boundary wins intact", () => {
		const { strategy, root } = mkStrategy();
		const cleanups: number[] = [];
		let inner = false;
		const Nested = () => {
			if (!inner) {
				inner = true;
				mountIgniteJsxOnce(
					root,
					jsx("section", {
						ref: () => () => {
							cleanups.push(1);
						},
						children: "winner",
					}),
				);
			}
			return jsx("p", { children: "loser" });
		};
		strategy.render(jsx(Nested, {}));
		expect(root.textContent).toBe("winner");
		expect(cleanups).toEqual([]);
	});
});

describe("S5 default* names are preserved only where they are exposed", () => {
	it("a dropped defaultValue is a plain attribute on a div and a kept default on an input", () => {
		for (const [tag, key] of [
			["div", "defaultValue"],
			["div", "defaultChecked"],
			["div", "defaultSelected"],
		] as const) {
			const { strategy, root } = mkStrategy();
			strategy.render(jsx(tag, { [key]: "x" }));
			strategy.render(jsx(tag, {}));
			const fresh = mkStrategy();
			fresh.strategy.render(jsx(tag, {}));
			expect(root.firstElementChild?.outerHTML).toBe(
				fresh.root.firstElementChild?.outerHTML,
			);
		}
		const { strategy, root } = mkStrategy();
		strategy.render(jsx("input", { defaultValue: "kept" }));
		strategy.render(jsx("input", {}));
		expect((root.firstElementChild as HTMLInputElement).defaultValue).toBe(
			"kept",
		);
	});
});

describe("S6 ownership is rechecked after every write", () => {
	let lastCb: HTMLElement | null = null;
	class Cb extends HTMLElement {
		static observedAttributes = ["a", "b"];
		attributeChangedCallback(_n: string, _o: unknown, v: unknown) {
			if (v === "1") {
				lastCb = this;
				hook?.("cb");
			}
		}
	}
	it("no trailing step follows the last write whose callback supersedes", () => {
		if (!customElements.get("x-cb")) customElements.define("x-cb", Cb);
		fc.assert(
			fc.property(
				fc.constantFrom("mount-same", "mount-other", "detach"),
				fc.boolean(),
				fc.boolean(),
				fc.boolean(),
				(event, patch, withRef, kids) => {
					document.body.replaceChildren();
					const { strategy, root } = mkStrategy();
					const refs: string[] = [];
					const view = (g: number) =>
						jsx("x-cb", {
							a: "0",
							b: `${g}`,
							ref: withRef ? () => void refs.push(`${g}`) : undefined,
							children: g && kids ? [jsx("i", {}), jsx("u", {})] : [],
						});
					if (patch) strategy.render(view(0));
					refs.length = 0;
					const seen: HTMLElement[] = [];
					hook = () => {
						hook = null;
						if (lastCb) seen.push(lastCb);
						if (event === "detach") strategy.detach();
						else
							(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
								root,
								jsx("p", {}),
							);
					};
					const before = root.innerHTML;
					strategy.render(view(1));
					expect(hook).toBeNull();
					expect(refs).not.toContain("1");
					for (const el of seen) expect(el.childNodes.length).toBe(0);
					if (event !== "detach") expect(root.innerHTML).toBe("<p></p>");
					else expect(root.innerHTML).not.toBe(before === "" ? "x" : "");
				},
			),
			{ seed: 169501, numRuns: 40 },
		);
	});
});
