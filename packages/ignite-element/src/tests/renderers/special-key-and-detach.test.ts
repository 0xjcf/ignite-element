import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Accepted rules (mini list, PR #168 threads on renderer.ts:128 and :1161):
// S1 An own custom setter is decided once, before ALL key-specific
//    normalization (class, className, style, default*, hidden, aria/data,
//    false-token keys, list, ...), on fresh render, update and drop.
// S2 Event-handler props stay listeners, never setters (documented decision).
// D1 detach() revokes in-flight work of the running render at every phase:
//    before publish, mid-patch, controlled flush, refs.
// D2 After a detach, re-attaching and rendering equals a fresh render.

const SPECIAL = [
	"style",
	"class",
	"className",
	"defaultValue",
	"defaultChecked",
	"defaultSelected",
	"hidden",
	"title",
	"data-x",
	"aria-label",
	"translate",
	"spellcheck",
	"draggable",
	"list",
	"tabIndex",
	"id",
	"slot",
	"dir",
	"lang",
] as const;

const log: Array<[string, unknown]> = [];
class SpecialEl extends HTMLElement {}
class HookEl extends HTMLElement {
	static hook: (() => void) | null = null;
	set trigger(_v: unknown) {
		HookEl.hook?.();
	}
}
beforeAll(() => {
	for (const key of SPECIAL) {
		Object.defineProperty(SpecialEl.prototype, key, {
			configurable: true,
			get: () => undefined,
			set(value: unknown) {
				log.push([key, value]);
			},
		});
	}
	customElements.define("x-special", SpecialEl);
	customElements.define("x-detach-hook", HookEl);
});
afterEach(() => {
	HookEl.hook = null;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

function attach() {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	return { shadow, strategy };
}

const valueArb = fc.oneof(
	fc.constantFrom<unknown>("a", "b c", false, 0, 7, null),
	fc.constant<unknown>({ color: "red" }),
);
const propsArb = fc.dictionary(fc.constantFrom(...SPECIAL), valueArb);

describe("S1 an own setter wins for every specially normalized key", () => {
	it("is called exactly as the model says and no attribute is written", () => {
		fc.assert(
			fc.property(
				fc.array(propsArb, { minLength: 1, maxLength: 4 }),
				(renders) => {
					document.body.replaceChildren();
					log.length = 0;
					const { shadow, strategy } = attach();
					let old: Record<string, unknown> | null = null;
					for (const props of renders) {
						log.length = 0;
						strategy.render(jsx("x-special", props));
						const expected: Array<[string, unknown]> = [];
						for (const [k, v] of Object.entries(props)) {
							if (v != null) expected.push([k, v]);
							else if (old && old[k] != null) expected.push([k, undefined]);
						}
						if (old) {
							for (const k of Object.keys(old)) {
								if (!(k in props) && old[k] != null)
									expected.push([k, undefined]);
							}
						}
						const key = (e: [string, unknown]) => e[0];
						expect(
							[...log].sort((x, y) => key(x).localeCompare(key(y))),
						).toEqual(expected.sort((x, y) => key(x).localeCompare(key(y))));
						expect(shadow.querySelector("x-special")?.attributes.length).toBe(
							0,
						);
						old = props;
					}
				},
			),
			{ seed: 168701, numRuns: 150 },
		);
	});
	it("event props stay listeners and do not call a same-named setter", () => {
		log.length = 0;
		const { shadow, strategy } = attach();
		let hits = 0;
		strategy.render(jsx("x-special", { onClick: () => hits++ }));
		shadow.querySelector("x-special")?.dispatchEvent(new Event("click"));
		expect(hits).toBe(1);
		expect(log).toEqual([]);
	});
});

type Phase = "patch" | "flush" | "ref";
const nativeValue = Object.getOwnPropertyDescriptor(
	HTMLInputElement.prototype,
	"value",
) as PropertyDescriptor;

describe("D1 detach revokes the running render at every phase", () => {
	const view = (v1: string, v2: string, refLog: string[]) =>
		jsx("div", {
			children: [
				jsx("x-detach-hook", { trigger: 1, "data-p": v1 }),
				jsx("input", {
					value: v1,
					ref: (n: Element | null) => refLog.push(`a:${n ? "set" : "null"}`),
				}),
				jsx("input", {
					value: v2,
					ref: (n: Element | null) => refLog.push(`b:${n ? "set" : "null"}`),
				}),
			],
		});
	it("no write or ref acquisition happens after detach, and re-attach equals fresh", () => {
		fc.assert(
			fc.property(
				fc.constantFrom<Phase>("patch", "flush", "ref"),
				fc.boolean(),
				(phase, rerender) => {
					document.body.replaceChildren();
					const { shadow, strategy } = attach();
					const refLog: string[] = [];
					strategy.render(view("a", "b", refLog));
					const [first, second] = Array.from(
						shadow.querySelectorAll("input"),
					) as HTMLInputElement[];
					const writes: string[] = [];
					let detached = false;
					const afterDetach: string[] = [];
					const detach = () => {
						if (detached) return;
						detached = true;
						strategy.detach();
					};
					const spy = (el: HTMLInputElement, name: string) =>
						Object.defineProperty(el, "value", {
							configurable: true,
							get() {
								return nativeValue.get?.call(this);
							},
							set(v: string) {
								if (detached) afterDetach.push(`${name}:${v}`);
								writes.push(`${name}:${v}`);
								nativeValue.set?.call(this, v);
								if (phase === "flush" && name === "first") detach();
							},
						});
					spy(first, "first");
					spy(second, "second");
					refLog.length = 0;
					const origPush = refLog.push.bind(refLog);
					refLog.push = (...items: string[]) => {
						if (detached) afterDetach.push(...items);
						const r = origPush(...items);
						if (phase === "ref" && items[0] === "a:set") detach();
						return r;
					};
					if (phase === "patch") HookEl.hook = detach;
					expect(() => strategy.render(view("a2", "b2", refLog))).not.toThrow();
					HookEl.hook = null;
					expect(detached).toBe(true);
					expect(afterDetach.filter((e) => !e.endsWith(":null"))).toEqual([]);
					strategy.attach(shadow);
					const final = view("p", "q", []);
					strategy.render(rerender ? final : final);
					const fresh = attach();
					fresh.strategy.render(final);
					const text = (s: ShadowRoot) =>
						s.querySelector("ignite-jsx-root")?.innerHTML;
					expect(text(shadow)).toBe(text(fresh.shadow));
				},
			),
			{ seed: 168702, numRuns: 30 },
		);
	});
});
