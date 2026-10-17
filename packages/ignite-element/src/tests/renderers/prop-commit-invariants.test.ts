import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as fc from "fast-check";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Accepted rules from .invariant-review/full-scope-review.md (M01-M22, G*).
// Each test names the rule it enforces.

const calls: string[] = [];

class ThrowingGetter extends HTMLElement {
	get bad(): string {
		throw new Error("getter throws");
	}
}
class ClassSetter extends HTMLElement {}
for (const key of ["className", "class"]) {
	Object.defineProperty(ClassSetter.prototype, key, {
		configurable: true,
		set(value: unknown) {
			calls.push(`${key}:${String(value)}`);
		},
	});
}
class OrderElement extends HTMLElement {
	set a(value: unknown) {
		calls.push(`a:${String(value)}`);
	}
	set b(value: unknown) {
		calls.push(`b:${String(value)}`);
	}
}
class Hook extends HTMLElement {
	static hook: (() => void) | null = null;
	set trigger(_value: unknown) {
		Hook.hook?.();
	}
}
beforeAll(() => {
	for (const [name, ctor] of [
		["x-throwing-getter", ThrowingGetter],
		["x-class-setter", ClassSetter],
		["x-order", OrderElement],
		["x-pc-hook", Hook],
	] as const) {
		if (!customElements.get(name)) customElements.define(name, ctor);
	}
});
beforeEach(() => {
	calls.length = 0;
	vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	Hook.hook = null;
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
function describeNode(node: Node): string {
	if (!(node instanceof Element)) return node.textContent ?? "";
	const attrs = Array.from(node.attributes)
		.map((a) => `${a.name}=${a.value}`)
		.sort()
		.join(",");
	const value = node instanceof HTMLInputElement ? `value:${node.value}` : "";
	return `<${node.localName} ${attrs} ${value}>${Array.from(node.childNodes).map(describeNode).join("")}</>`;
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
const nativeValue = Object.getOwnPropertyDescriptor(
	HTMLInputElement.prototype,
	"value",
) as PropertyDescriptor;

describe("M01 release-note claims match the code", () => {
	const changeset = readFileSync(
		resolve(process.cwd(), "../../.changeset/renderer-blocked-sinks.md"),
		"utf8",
	);
	it("does not promise that sets apply before drops", () => {
		expect(changeset).not.toMatch(/Sets apply before drops/);
		expect(changeset).toMatch(/Drops apply before sets/);
	});
	it("states when an own setter receives undefined, including a change to null", () => {
		expect(changeset).toMatch(/changes to `null` or `undefined`/);
	});
	it("does not claim an executable SMIL value can never stay on a bare animate", () => {
		expect(changeset).not.toMatch(/cannot remain on a bare `animate`/);
	});
});

describe("M02/M03 drops run before sets", () => {
	it("an own setter sees the drop of the old prop before the new prop", () => {
		const { strategy } = attach();
		strategy.render(jsx("x-order", { a: 1 }));
		calls.length = 0;
		strategy.render(jsx("x-order", { b: 2 }));
		expect(calls).toEqual(["a:undefined", "b:2"]);
	});
});

describe("M04 SMIL dependent values are guarded by a stated rule", () => {
	const executable = "javascript:alert(1)";
	const attrOf = (shadow: ShadowRoot, name: string) =>
		shadow.querySelector("animate")?.getAttribute(name) ?? null;
	it("a non-string attributeName never keeps an executable value, fresh or updated", () => {
		fc.assert(
			fc.property(
				fc.constantFrom<unknown>(123, true, {}, ["href"]),
				fc.boolean(),
				(name, viaUpdate) => {
					document.body.replaceChildren();
					const { shadow, strategy } = attach();
					if (viaUpdate) {
						strategy.render(
							jsx("svg", {
								children: jsx("animate", { attributeName: "fill", to: "red" }),
							}),
						);
					}
					strategy.render(
						jsx("svg", {
							children: jsx("animate", { attributeName: name, to: executable }),
						}),
					);
					expect(attrOf(shadow, "to")).toBeNull();
				},
			),
			{ seed: 168601, numRuns: 100 },
		);
	});
	it("an href target never keeps an executable value, fresh or updated", () => {
		for (const prefix of [false, true]) {
			document.body.replaceChildren();
			const { shadow, strategy } = attach();
			if (prefix) {
				strategy.render(
					jsx("svg", {
						children: jsx("animate", { attributeName: "fill", to: executable }),
					}),
				);
			}
			strategy.render(
				jsx("svg", {
					children: jsx("animate", {
						attributeName: "xlink:href",
						to: executable,
					}),
				}),
			);
			expect(attrOf(shadow, "to")).toBeNull();
		}
	});
	it("an absent or null attributeName is the documented non-href case: the value stays (animateMotion paths)", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("svg", { children: jsx("animate", { to: "10,20" }) }));
		expect(attrOf(shadow, "to")).toBe("10,20");
	});
});

describe("M06 a throwing user property never aborts a commit", () => {
	it("a getter-only property that throws does not stop later props, children or refs", () => {
		const { shadow, strategy } = attach();
		let ref: Element | null = null;
		expect(() =>
			strategy.render(
				jsx("div", {
					children: [
						jsx("x-throwing-getter", { bad: 1, "data-after": "1" }),
						jsx("p", {
							children: "tail",
							ref: (n: Element | null) => {
								ref = n;
							},
						}),
					],
				}),
			),
		).not.toThrow();
		expect(
			shadow.querySelector("x-throwing-getter")?.getAttribute("data-after"),
		).toBe("1");
		expect(shadow.querySelector("p")?.textContent).toBe("tail");
		expect(ref).not.toBeNull();
	});
	it("a throwing getter on a controlled field does not stop sibling controlled writes", () => {
		const { shadow, strategy } = attach();
		const view = (v1: string, v2: string) =>
			jsx("div", {
				children: [jsx("input", { value: v1 }), jsx("input", { value: v2 })],
			});
		strategy.render(view("a", "b"));
		const [first, second] = Array.from(
			shadow.querySelectorAll("input"),
		) as HTMLInputElement[];
		Object.defineProperty(first, "value", {
			configurable: true,
			get() {
				throw new Error("getter throws");
			},
			set(v: string) {
				nativeValue.set?.call(this, v);
			},
		});
		expect(() => strategy.render(view("a2", "b2"))).not.toThrow();
		expect(second.value).toBe("b2");
	});
	it("random throwing accessors never prevent the remaining props from committing", () => {
		fc.assert(
			fc.property(fc.boolean(), fc.constantFrom("1", "2"), (withBad, value) => {
				document.body.replaceChildren();
				const { shadow, strategy } = attach();
				const props: Record<string, unknown> = { "data-x": value };
				if (withBad) props.bad = 1;
				expect(() =>
					strategy.render(jsx("x-throwing-getter", props)),
				).not.toThrow();
				expect(
					shadow.querySelector("x-throwing-getter")?.getAttribute("data-x"),
				).toBe(value);
			}),
			{ seed: 168602, numRuns: 50 },
		);
	});
});

describe("M22 dev warnings never read user properties", () => {
	it("duplicate spellings on an element with a throwing getter still render", () => {
		const { shadow, strategy } = attach();
		expect(() =>
			strategy.render(
				jsx("x-throwing-getter", { bad: 1, BAD: 2, "data-a": "1" }),
			),
		).not.toThrow();
		expect(
			shadow.querySelector("x-throwing-getter")?.getAttribute("data-a"),
		).toBe("1");
	});
});

describe("M08 an own class/className setter is honored before class normalization", () => {
	it.each(["className", "class"] as const)(
		"%s reaches an own setter once per render, including false and drop",
		(key) => {
			const { shadow, strategy } = attach();
			strategy.render(jsx("x-class-setter", { [key]: false }));
			strategy.render(jsx("x-class-setter", { [key]: "a b" }));
			strategy.render(jsx("x-class-setter", {}));
			expect(calls).toEqual([`${key}:false`, `${key}:a b`, `${key}:undefined`]);
			expect(
				shadow.querySelector("x-class-setter")?.hasAttribute("class"),
			).toBe(false);
		},
	);
	it("an element without an own setter keeps the class attribute behavior", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("div", { className: "a b" }));
		expect(
			shadow
				.querySelector("div div, ignite-jsx-root > div")
				?.getAttribute("class"),
		).toBe("a b");
		strategy.render(jsx("div", {}));
		expect(
			shadow.querySelector("ignite-jsx-root > div")?.hasAttribute("class"),
		).toBe(false);
	});
});

describe("M10/M11/M12 detach is a superseding commit", () => {
	const two = (v1: string, v2: string) =>
		jsx("div", {
			children: [jsx("input", { value: v1 }), jsx("input", { value: v2 })],
		});
	it("a controlled setter that detaches stops the remaining controlled writes", () => {
		const { shadow, strategy } = attach();
		strategy.render(two("a", "b"));
		const [first, second] = Array.from(
			shadow.querySelectorAll("input"),
		) as HTMLInputElement[];
		const log: string[] = [];
		let fired = false;
		Object.defineProperty(first, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set(v: string) {
				nativeValue.set?.call(this, v);
				if (v === "a2" && !fired) {
					fired = true;
					strategy.detach();
				}
			},
		});
		Object.defineProperty(second, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set(v: string) {
				log.push(v);
				nativeValue.set?.call(this, v);
			},
		});
		strategy.render(two("a2", "b2"));
		expect(log).toEqual([]);
	});
	it("a setter that detaches mid-patch leaves no published tree behind", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("div", { "data-a": "1" }));
		Hook.hook = () => strategy.detach();
		strategy.render(jsx("div", { children: jsx("x-pc-hook", { trigger: 1 }) }));
		Hook.hook = null;
		strategy.attach(shadow);
		const final = jsx("div", { "data-z": "9" });
		strategy.render(final);
		expect(snapshot(shadow)).toBe(fresh(final));
	});
});

describe("M13 state shared between bundled copies is never trusted from one copy", () => {
	it("a rootless mount from another copy invalidates this copy's cached tree", async () => {
		vi.resetModules();
		const other = await import("../../renderers/jsx/IgniteJsxRenderStrategy");
		expect(other.mountIgniteJsxOnce).not.toBe(mountIgniteJsxOnce);
		const { shadow, strategy } = attach();
		strategy.render(
			jsx("div", {
				children: [jsx("input", { value: "x" }), jsx("input", { value: "y" })],
			}),
		);
		const first = shadow.querySelector("input") as HTMLInputElement;
		let fired = false;
		Object.defineProperty(first, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set(v: string) {
				nativeValue.set?.call(this, v);
				if (v === "x2" && !fired) {
					fired = true;
					other.mountIgniteJsxOnce(
						shadow.querySelector("ignite-jsx-root") as HTMLElement,
						jsx("div", { "data-extra": "1" }),
					);
				}
			},
		});
		strategy.render(
			jsx("div", {
				children: [
					jsx("input", { value: "x2" }),
					jsx("input", { value: "y2" }),
				],
			}),
		);
		const final = jsx("div", {
			children: [jsx("input", { value: "p" }), jsx("input", { value: "q" })],
		});
		strategy.render(final);
		expect(snapshot(shadow)).toBe(fresh(final));
	});
});

describe("G30 a rootless mount into a strategy root while it is writing wins", () => {
	it("an older commit never publishes over a mount made from a setter", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("div", { "data-a": "1" }));
		const mounted = jsx("section", { "data-m": "1" });
		Hook.hook = () =>
			mountIgniteJsxOnce(
				shadow.querySelector("ignite-jsx-root") as HTMLElement,
				mounted,
			);
		strategy.render(jsx("div", { children: jsx("x-pc-hook", { trigger: 1 }) }));
		Hook.hook = null;
		expect(snapshot(shadow)).toBe(fresh(mounted));
		const final = jsx("div", { "data-z": "1" });
		strategy.render(final);
		expect(snapshot(shadow)).toBe(fresh(final));
	});
});

describe("G33/G35 post-publish throws and external DOM edits", () => {
	it("a controlled setter that throws leaves the published tree valid", () => {
		const { shadow, strategy } = attach();
		const view = (v: string, extra: string) =>
			jsx("div", { "data-e": extra, children: jsx("input", { value: v }) });
		strategy.render(view("a", "1"));
		const input = shadow.querySelector("input") as HTMLInputElement;
		Object.defineProperty(input, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set() {
				throw new Error("setter throws");
			},
		});
		expect(() => strategy.render(view("b", "2"))).not.toThrow();
		const final = view("c", "3");
		Reflect.deleteProperty(input, "value");
		strategy.render(final);
		expect(snapshot(shadow)).toBe(fresh(final));
	});
	it("drop membership comes from props, not from DOM edits made between renders", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("a", "b"),
				fc.constantFrom("1", "2"),
				(key, value) => {
					document.body.replaceChildren();
					const { shadow, strategy } = attach();
					strategy.render(jsx("div", { "data-a": "1", "data-b": "1" }));
					const el = shadow.querySelector(
						"ignite-jsx-root > div",
					) as HTMLElement;
					el.setAttribute("data-foreign", "x");
					const final = jsx("div", {
						[`data-${key}`]: value,
						"data-b": "1",
						...(key === "a" ? {} : {}),
					});
					strategy.render(final);
					el.removeAttribute("data-foreign");
					expect(snapshot(shadow)).toBe(fresh(final));
				},
			),
			{ seed: 168603, numRuns: 40 },
		);
	});
});

describe("mutation survivors triaged into tests", () => {
	it("an own setter gets undefined, once, when a prop becomes null or undefined", () => {
		for (const value of [null, undefined]) {
			calls.length = 0;
			const { strategy } = attach();
			strategy.render(jsx("x-order", { a: 1 }));
			strategy.render(jsx("x-order", { a: value }));
			expect(calls).toEqual(["a:1", "a:undefined"]);
		}
	});
	it("className and class reach the class attribute on svg and html, and drop it", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("svg", { className: "a" }));
		expect(shadow.querySelector("svg")?.getAttribute("class")).toBe("a");
		strategy.render(jsx("svg", { className: "b" }));
		expect(shadow.querySelector("svg")?.getAttribute("class")).toBe("b");
		strategy.render(jsx("svg", {}));
		expect(shadow.querySelector("svg")?.hasAttribute("class")).toBe(false);
		strategy.render(jsx("div", { class: "c" }));
		expect(
			shadow.querySelector("ignite-jsx-root > div")?.getAttribute("class"),
		).toBe("c");
	});
	it("a controlled input skips an equal value, a select always writes", () => {
		const log: string[] = [];
		const spy = (el: HTMLElement, proto: object) => {
			const desc = Object.getOwnPropertyDescriptor(
				proto,
				"value",
			) as PropertyDescriptor;
			Object.defineProperty(el, "value", {
				configurable: true,
				get() {
					return desc.get?.call(this);
				},
				set(v: string) {
					log.push(`${el.localName}:${v}`);
					desc.set?.call(this, v);
				},
			});
		};
		const { shadow, strategy } = attach();
		const view = jsx("div", {
			children: [
				jsx("input", { value: "a" }),
				jsx("select", {
					value: "a",
					children: jsx("option", { value: "a", children: "a" }),
				}),
			],
		});
		strategy.render(view);
		spy(
			shadow.querySelector("input") as HTMLElement,
			HTMLInputElement.prototype,
		);
		spy(
			shadow.querySelector("select") as HTMLElement,
			HTMLSelectElement.prototype,
		);
		strategy.render(view);
		expect(log).toEqual(["select:a"]);
	});
	it("a native property that already holds the value is not written again", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("div", { title: "a" }));
		const el = shadow.querySelector("ignite-jsx-root > div") as HTMLElement;
		const writes: string[] = [];
		Object.defineProperty(el, "title", {
			configurable: true,
			get: () => "b",
			set: (v: string) => void writes.push(v),
		});
		strategy.render(jsx("div", { title: "b" }));
		expect(writes).toEqual([]);
	});
	it("a dropped default* prop leaves the native default in place", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("input", { defaultValue: "x" }));
		strategy.render(jsx("input", {}));
		expect(shadow.querySelector("input")?.getAttribute("value")).toBe("x");
	});
	it("dropping a controlled prop warns in development builds", () => {
		const { strategy } = attach();
		strategy.render(jsx("input", { checked: true }));
		strategy.render(jsx("input", {}));
		expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/checked/));
	});
	it("a queued render that throws reaches the caller when the outer render succeeds", () => {
		const { strategy } = attach();
		const boom = () => {
			throw new Error("queued");
		};
		Hook.hook = () => {
			Hook.hook = null;
			strategy.render(jsx(boom, {}));
		};
		expect(() =>
			strategy.render(
				jsx("div", { children: jsx("x-pc-hook", { trigger: 1 }) }),
			),
		).toThrow("queued");
	});
	it("a data-ignite-nodiff host replaces nodes, a normal host keeps them", () => {
		for (const nodiff of [true, false]) {
			document.body.replaceChildren();
			const host = document.createElement("div");
			if (nodiff) host.setAttribute("data-ignite-nodiff", "");
			document.body.appendChild(host);
			const shadow = host.attachShadow({ mode: "open" });
			const strategy = createIgniteJsxRenderStrategy();
			strategy.attach(shadow);
			strategy.render(jsx("p", { children: "a" }));
			const first = shadow.querySelector("p");
			strategy.render(jsx("p", { children: "b" }));
			expect(shadow.querySelector("p") === first).toBe(!nodiff);
		}
	});
	it("detach tolerates a content root that was already removed", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("p", { children: "a" }));
		shadow.querySelector("ignite-jsx-root")?.remove();
		expect(() => strategy.detach()).not.toThrow();
	});
	it("a remaining spelling is re-applied when its differently spelled twin is dropped", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("form", { acceptCharset: "24", acceptcharset: "d" }));
		strategy.render(jsx("form", { acceptCharset: "24" }));
		expect(shadow.querySelector("form")?.getAttribute("accept-charset")).toBe(
			"24",
		);
	});
});
