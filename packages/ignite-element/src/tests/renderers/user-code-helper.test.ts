import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Rules (PR #168, round 10). ONE rule: every call into user code (getters,
// setters, listener methods, component bodies) goes through the single helper
// `act`, which checks ownership before and after and aborts the walk.
//  U1 structural: no user-code call in renderer.ts bypasses `act`.
//  U2 a property getter that supersedes stops the walk before the next prop.
//  U3 an overridden addEventListener/removeEventListener that supersedes stops
//     the walk before later setters run.
//  U4 a function component that supersedes stops later siblings from running.
//  U5 an own setter is cleared only if the renderer actually set it (explicit
//     per-key state): never for blocked, null, or never-set values.
//  U6 a drop clears the attribute fallback BEFORE the setter runs, so a
//     reflection the setter makes (even to an unchanged string) survives.

let hook: (() => void) | null = null;
const log: unknown[] = [];
let otherMount: typeof mountIgniteJsxOnce;
class Getter extends HTMLElement {
	get a(): number {
		hook?.();
		return 1;
	}
	get b(): number {
		log.push("b");
		return 1;
	}
}
class Listener extends HTMLElement {
	get b(): number {
		log.push("b");
		return 1;
	}
	set s(v: unknown) {
		log.push(`s${String(v)}`);
	}
	addEventListener(...a: Parameters<HTMLElement["addEventListener"]>) {
		hook?.();
		super.addEventListener(...a);
	}
	removeEventListener(...a: Parameters<HTMLElement["removeEventListener"]>) {
		hook?.();
		super.removeEventListener(...a);
	}
}
class Href extends HTMLElement {
	set href(v: unknown) {
		log.push(v);
	}
}
class Reflect2 extends HTMLElement {
	set foo(_v: unknown) {
		this.setAttribute("foo", "default");
	}
}
beforeAll(async () => {
	customElements.define("x-u-get", Getter);
	customElements.define("x-u-lis", Listener);
	customElements.define("x-u-href", Href);
	customElements.define("x-u-refl", Reflect2);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	hook = null;
	log.length = 0;
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
const events = fc.constantFrom("mount-same", "mount-other", "detach");
const fire = (
	event: string,
	strategy: { detach(): void },
	root: HTMLElement,
) => {
	if (event === "detach") strategy.detach();
	else
		(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
			root,
			jsx("p", {}),
		);
};

describe("U1 no user-code call bypasses act", () => {
	it("renderer.ts calls user code only inside act", () => {
		const src = readFileSync(
			resolve(
				__dirname,
				"../../../../ignite-renderer/src/renderers/jsx/renderer.ts",
			),
			"utf8",
		);
		const body = src.slice(
			src.indexOf("function act("),
			src.indexOf("\n}\n", src.indexOf("function act(")),
		);
		const rest = src.replace(body, "");
		const bad =
			/\.(appendChild|insertBefore|replaceChild|removeChild|setAttribute|removeAttribute|addEventListener|removeEventListener|setProperty|removeProperty|getAttribute|getPropertyValue|focus)\(|Reflect\.(get|set)\(|\.type\(|\[method\]\(/;
		const offenders = rest
			.split("\n")
			.map((line, i, all) => ({
				line: line.trim(),
				native: /native:/.test(`${all[i - 1] ?? ""}${line}`),
			}))
			.filter(
				({ line, native }) =>
					!line.startsWith("//") && !native && bad.test(line),
			);
		expect(offenders).toEqual([]);
	});
});

describe("U2 a property getter that supersedes stops the walk", () => {
	it("the next prop's getter never runs on the retired element", () => {
		fc.assert(
			fc.property(events, (event) => {
				log.length = 0;
				document.body.replaceChildren();
				const { strategy, root } = mk();
				strategy.render(jsx("x-u-get", { a: 0, b: 0 }));
				log.length = 0;
				hook = () => {
					hook = null;
					fire(event, strategy, root);
				};
				strategy.render(jsx("x-u-get", { a: 1, b: 1 }));
				expect(log).toEqual([]);
			}),
			{ seed: 169801, numRuns: 20 },
		);
	});
});

describe("U3 overridden listener methods are guarded", () => {
	it.each(["add", "remove"])(
		"an overridden %sEventListener that supersedes stops later setters",
		(kind) => {
			fc.assert(
				fc.property(events, (event) => {
					log.length = 0;
					document.body.replaceChildren();
					const { strategy, root } = mk();
					const f1 = () => {};
					const f2 = () => {};
					strategy.render(jsx("x-u-lis", { onClick: f1, b: 0 }));
					log.length = 0;
					hook = () => {
						hook = null;
						fire(event, strategy, root);
					};
					strategy.render(
						jsx(
							"x-u-lis",
							kind === "add" ? { onClick: f2, b: 1, s: 1 } : { b: 1, s: 1 },
						),
					);
					expect(log).toEqual([]);
				}),
				{ seed: 169802, numRuns: 20 },
			);
		},
	);
});

describe("U4 a superseding component stops later siblings", () => {
	it("no later component body runs after supersession", () => {
		fc.assert(
			fc.property(events, fc.boolean(), (event, nested) => {
				document.body.replaceChildren();
				const { strategy, root } = mk();
				let later = 0;
				const First = () => {
					fire(event, strategy, root);
					return jsx("i", {});
				};
				const Later = () => {
					later++;
					return jsx("u", {});
				};
				const list = [jsx(First, {}), jsx(Later, {}), jsx(Later, {})];
				strategy.render(nested ? jsx("div", { children: list }) : list);
				expect(later).toBe(0);
			}),
			{ seed: 169803, numRuns: 20 },
		);
	});
});

describe("U5 an own setter is cleared only if it was set", () => {
	it("follows the set-state model over blocked, nullish and safe renders", () => {
		const state = fc.constantFrom("absent", "null", "undef", "safe", "blocked");
		fc.assert(
			fc.property(fc.array(state, { minLength: 1, maxLength: 8 }), (seq) => {
				log.length = 0;
				document.body.replaceChildren();
				const { strategy } = mk();
				const expected: unknown[] = [];
				let used = false;
				for (const s of seq) {
					const props: Record<string, unknown> = {};
					if (s === "null") props.href = null;
					if (s === "undef") props.href = undefined;
					if (s === "safe") props.href = "https://a.test/";
					if (s === "blocked") props.href = "javascript:alert(1)";
					strategy.render(jsx("x-u-href", props));
					if (s === "safe") {
						expected.push("https://a.test/");
						used = true;
					} else if (used) {
						expected.push(undefined);
						used = false;
					}
				}
				expect(log).toEqual(expected);
			}),
			{ seed: 169804, numRuns: 80 },
		);
	});
});

describe("U6 a drop keeps a same-valued reflection", () => {
	it("the setter's attribute survives even when it equals the earlier one", () => {
		const { strategy, root } = mk();
		strategy.render(jsx("x-u-refl", { foo: "a" }));
		strategy.render(jsx("x-u-refl", {}));
		expect(root.firstElementChild?.getAttribute("foo")).toBe("default");
	});
});
