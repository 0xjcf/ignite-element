import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Rules (PR #168, round 7):
//  R1 any property read that can run user code is contained and followed by an
//     ownership check, including the special `style` read.
//  R2 a getter-only or throwing `style` never aborts the render: later props,
//     children and refs still commit.
//  R3 a blocked URL value clears an own setter only when an earlier render
//     committed that sink; a never-set property is never called.

let hook: (() => void) | null = null;
let otherMount: typeof mountIgniteJsxOnce;
const calls: unknown[] = [];
class Thrower extends HTMLElement {
	get style(): CSSStyleDeclaration {
		throw new Error("boom");
	}
}
class Undef extends HTMLElement {
	get style(): CSSStyleDeclaration {
		return undefined as unknown as CSSStyleDeclaration;
	}
}
class Hooked extends HTMLElement {
	get style(): CSSStyleDeclaration {
		hook?.();
		return undefined as unknown as CSSStyleDeclaration;
	}
}
class Href extends HTMLElement {
	set href(v: unknown) {
		calls.push(v);
	}
}
beforeAll(async () => {
	customElements.define("x-throw", Thrower);
	customElements.define("x-undef", Undef);
	customElements.define("x-hooked", Hooked);
	customElements.define("x-href", Href);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	hook = null;
	calls.length = 0;
	document.body.replaceChildren();
});
const mk = () => {
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

describe("R2 a getter-only style never aborts the render", () => {
	it.each(["x-throw", "x-undef"])(
		"%s keeps later props, children and refs",
		(tag) => {
			const { strategy, root } = mk();
			const refs: unknown[] = [];
			for (let pass = 0; pass < 2; pass++) {
				strategy.render(
					jsx(tag, {
						style: { color: "red" },
						title: `t${pass}`,
						ref: (el: unknown) => void refs.push(el),
						children: jsx("i", {}),
					}),
				);
			}
			const el = root.firstElementChild as HTMLElement;
			expect(el.getAttribute("title")).toBe("t1");
			expect(el.children.length).toBe(1);
			expect(refs.length).toBeGreaterThan(0);
		},
	);
});

describe("R1 the style read is followed by an ownership check", () => {
	it("a style getter that supersedes stops every later write", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("mount-same", "mount-other", "detach"),
				fc.integer({ min: 1, max: 3 }),
				(event, extra) => {
					document.body.replaceChildren();
					const { strategy, root } = mk();
					const view = (g: number) =>
						jsx("x-hooked", {
							style: { color: "red" },
							...Object.fromEntries(
								Array.from({ length: extra }, (_, i) => [`data-p${i}`, `${g}`]),
							),
							children: [jsx("i", {}), jsx("u", {})],
						});
					strategy.render(view(0));
					const el = root.firstElementChild as HTMLElement;
					let fired = false;
					hook = () => {
						if (fired) return;
						fired = true;
						if (event === "detach") strategy.detach();
						else
							(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
								root,
								jsx("p", {}),
							);
					};
					const snap = () => el.outerHTML;
					let after = "";
					const orig = el.setAttribute;
					el.setAttribute = function (...a: [string, string]) {
						if (fired) after += a[0];
						return orig.apply(this, a);
					};
					strategy.render(view(1));
					expect(fired).toBe(true);
					expect(after).toBe("");
					expect(snap()).not.toContain('data-p0="1"');
				},
			),
			{ seed: 169601, numRuns: 30 },
		);
	});
});

describe("R3 a blocked URL clears only a committed sink", () => {
	it("a never-set own href setter is not called on a blocked first render", () => {
		const { strategy } = mk();
		strategy.render(jsx("x-href", { href: "javascript:alert(1)" }));
		strategy.render(jsx("x-href", { href: "javascript:alert(2)" }));
		expect(calls).toEqual([]);
	});
	it("a committed href is cleared once when it becomes blocked", () => {
		const { strategy } = mk();
		strategy.render(jsx("x-href", { href: "https://a.test/" }));
		strategy.render(jsx("x-href", { href: "javascript:alert(1)" }));
		expect(calls).toEqual(["https://a.test/", undefined]);
		strategy.render(jsx("x-href", { href: "javascript:alert(2)" }));
		expect(calls).toEqual(["https://a.test/", undefined]);
	});
});
