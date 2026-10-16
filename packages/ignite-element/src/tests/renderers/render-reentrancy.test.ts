import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Invariants R01-R13 (.invariant-review/reentrancy-write-phase.md): after any
// render() call returns, the DOM equals a fresh render of the LAST requested
// view, whichever phase user code called render() from.

class ReenterElement extends HTMLElement {
	static hook: (() => void) | null = null;
	set trigger(_value: unknown) {
		ReenterElement.hook?.();
	}
}
beforeAll(() => {
	if (!customElements.get("x-rp"))
		customElements.define("x-rp", ReenterElement);
});
afterEach(() => {
	ReenterElement.hook = null;
	document.body.replaceChildren();
});

function attach() {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	return { shadow, strategy };
}

function describeNode(node: Node): string {
	if (!(node instanceof Element)) return node.textContent ?? "";
	const attrs = Array.from(node.attributes)
		.map((a) => `${a.name}=${a.value}`)
		.sort()
		.join(",");
	const props = node instanceof HTMLInputElement ? `value:${node.value}` : "";
	return `<${node.localName} ${attrs} ${props}>${Array.from(node.childNodes)
		.map(describeNode)
		.join("")}</>`;
}
const snapshot = (shadow: ShadowRoot) => {
	const root = shadow.querySelector("ignite-jsx-root");
	return root ? describeNode(root) : "";
};
function fresh(view: IgniteJsxChild): string {
	const { shadow, strategy } = attach();
	strategy.render(view);
	return snapshot(shadow);
}

type Spec = { id: string; a: string; v1: string; v2: string };
const base = (spec: Spec, extra: IgniteJsxChild[] = []): IgniteJsxChild =>
	jsx("div", {
		"data-id": spec.id,
		"data-a": spec.a,
		children: [
			jsx("input", { value: spec.v1 }),
			jsx("input", { value: spec.v2 }),
			...extra,
		],
	});

const nativeValue = Object.getOwnPropertyDescriptor(
	HTMLInputElement.prototype,
	"value",
) as PropertyDescriptor;

describe("render re-entrancy", () => {
	it("a setter on a controlled field that renders again is not overwritten by the outer flush", () => {
		const { shadow, strategy } = attach();
		strategy.render(base({ id: "0", a: "0", v1: "x", v2: "y" }));
		const first = shadow.querySelector("input") as HTMLInputElement;
		const inner = base({ id: "n", a: "n", v1: "x3", v2: "y3" });
		let fired = false;
		Object.defineProperty(first, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set(value: string) {
				nativeValue.set?.call(this, value);
				if (value === "x2" && !fired) {
					fired = true;
					strategy.render(inner);
				}
			},
		});
		strategy.render(base({ id: "o", a: "o", v1: "x2", v2: "y2" }));
		expect(snapshot(shadow)).toBe(fresh(inner));
	});

	it("an outer render that throws mid-patch does not strand a queued render", () => {
		const { shadow, strategy } = attach();
		strategy.render(base({ id: "0", a: "0", v1: "x", v2: "y" }));
		const inner = base({ id: "n", a: "n", v1: "x3", v2: "y3" });
		let fired = false;
		ReenterElement.hook = () => {
			if (fired) return;
			fired = true;
			strategy.render(inner);
		};
		const boom = new Error("boom");
		const throwing = jsx("div", {
			style: {
				get color(): string {
					throw boom;
				},
			},
		});
		expect(() =>
			strategy.render(
				base({ id: "o", a: "o", v1: "x2", v2: "y2" }, [
					jsx("x-rp", { trigger: 1 }),
					throwing,
				]),
			),
		).toThrow(boom);
		expect(snapshot(shadow)).toBe(fresh(inner));
	});

	it("a render after a mid-patch throw converges on its view", () => {
		const { shadow, strategy } = attach();
		strategy.render(base({ id: "0", a: "0", v1: "x", v2: "y" }));
		expect(() =>
			strategy.render(
				base({ id: "o", a: "o", v1: "x2", v2: "y2" }, [
					jsx("div", {
						style: {
							get color(): string {
								throw new Error("boom");
							},
						},
					}),
				]),
			),
		).toThrow();
		const final = base({ id: "f", a: "f", v1: "x9", v2: "y9" });
		strategy.render(final);
		expect(snapshot(shadow)).toBe(fresh(final));
	});

	it("a setter that mounts an unrelated tree does not cancel the outer controlled writes", () => {
		const { shadow, strategy } = attach();
		strategy.render(base({ id: "0", a: "0", v1: "x", v2: "y" }));
		ReenterElement.hook = () => {
			const other = document.createElement("div");
			document.body.append(other);
			mountIgniteJsxOnce(other, jsx("p", { children: "other" }));
		};
		const outer = base({ id: "o", a: "o", v1: "x2", v2: "y2" }, [
			jsx("x-rp", { trigger: 1 }),
		]);
		strategy.render(outer);
		expect(snapshot(shadow)).toBe(fresh(outer));
	});

	// Phases that can call render(): custom setter (before publish), controlled
	// flush (after publish), ref and cleanup (after publish), and an outer throw.
	const phases = ["setter", "controlled", "ref", "cleanup", "throw"] as const;
	type Phase = (typeof phases)[number];
	const specArb = fc.record({
		id: fc.constantFrom("a", "b", "c"),
		a: fc.constantFrom("1", "2", "3"),
		v1: fc.constantFrom("p", "q", "r"),
		v2: fc.constantFrom("s", "t", "u"),
	});

	it("interleaved nested renders at any phase converge on the last requested view", () => {
		fc.assert(
			fc.property(
				specArb,
				specArb,
				fc.uniqueArray(fc.constantFrom(...phases), { maxLength: 5 }),
				fc.array(specArb, { minLength: 5, maxLength: 5 }),
				specArb,
				(baseline, outerSpec, active, nestedSpecs, finalSpec) => {
					document.body.replaceChildren();
					const { shadow, strategy } = attach();
					const requested: IgniteJsxChild[] = [];
					const request = (phase: Phase) => {
						const view = base(nestedSpecs[phases.indexOf(phase)]);
						requested.push(view);
						strategy.render(view);
					};
					const fired = new Set<Phase>();
					const once = (phase: Phase) => () => {
						if (fired.has(phase)) return;
						fired.add(phase);
						request(phase);
					};
					ReenterElement.hook = once("setter");
					// Baseline: a ref whose cleanup renders again when it is replaced.
					const baselineView = jsx("div", {
						children: [
							base(baseline),
							jsx("i", {
								ref: () => () => {
									if (active.includes("cleanup")) once("cleanup")();
								},
							}),
						],
					});
					strategy.render(baselineView);
					const input = shadow.querySelector("input") as HTMLInputElement;
					if (active.includes("controlled")) {
						Object.defineProperty(input, "value", {
							configurable: true,
							get() {
								return nativeValue.get?.call(this);
							},
							set(value: string) {
								nativeValue.set?.call(this, value);
								if (value === outerSpec.v1) once("controlled")();
							},
						});
					}
					const extras: IgniteJsxChild[] = [];
					if (active.includes("setter"))
						extras.push(jsx("x-rp", { trigger: 1 }));
					extras.push(
						jsx("i", {
							ref: () => {
								if (active.includes("ref")) once("ref")();
							},
						}),
					);
					if (active.includes("throw")) {
						extras.push(
							jsx("div", {
								style: {
									get color(): string {
										throw new Error("boom");
									},
								},
							}),
						);
					}
					const outer = jsx("div", { children: [base(outerSpec), ...extras] });
					try {
						strategy.render(outer);
					} catch {
						// the throw phase is expected to surface
					}
					const last = requested[requested.length - 1];
					if (last) expect(snapshot(shadow)).toBe(fresh(last));
					// Whatever happened, the next render converges.
					// A cleanup that fires during this render requests a newer view.
					const final = base(finalSpec);
					requested.push(final);
					strategy.render(final);
					expect(snapshot(shadow)).toBe(fresh(requested[requested.length - 1]));
				},
			),
			{ seed: 168504, numRuns: 400 },
		);
	});
});
