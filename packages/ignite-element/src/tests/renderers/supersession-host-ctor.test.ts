import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Rules (PR #168, round 11). The single helper rule widens:
//  V1 a custom element constructor is user code: createElement goes through
//     `act`, so a constructor that supersedes stops the construction.
//  V2 host callbacks (select, mount, update, describe) are user code: the host
//     bridge checks ownership after each, and a mount result of a superseded
//     commit is disposed, never delivered.
//  V3 the unwinding sentinel is private: a thrown user symbol (including
//     Symbol.for("ignite.o")) is never mistaken for supersession.
//  V4 committed state is explicit: a fallback attribute the renderer wrote is
//     removed before an upgraded setter runs, and forgotten when the renderer
//     removes it.
//  V5 the handbook states the committed rule: only previously committed
//     non-nullish values are cleared on drop.

let ctorHook: (() => void) | null = null;
let laterCtors = 0;
let otherMount: typeof mountIgniteJsxOnce;
class First extends HTMLElement {
	constructor() {
		super();
		const hook = ctorHook;
		ctorHook = null;
		hook?.();
	}
}
class Later extends HTMLElement {
	constructor() {
		super();
		laterCtors++;
	}
}
beforeAll(async () => {
	customElements.define("x-v-first", First);
	customElements.define("x-v-later", Later);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	ctorHook = null;
	laterCtors = 0;
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

describe("V1 a constructor that supersedes stops the construction", () => {
	it("no later constructor runs", () => {
		fc.assert(
			fc.property(events, (event) => {
				laterCtors = 0;
				document.body.replaceChildren();
				const { strategy, root } = mk();
				ctorHook = () => {
					if (event === "detach") strategy.detach();
					else
						(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
							root,
							jsx("p", {}),
						);
				};
				strategy.render(
					jsx("x-v-first", {
						children: [jsx("x-v-later", {}), jsx("x-v-later", {})],
					}),
				);
				expect(laterCtors).toBe(0);
			}),
			{ seed: 169901, numRuns: 20 },
		);
	});
});

describe("V3 the unwinding sentinel is private", () => {
	it("a component that throws the owner symbol propagates", () => {
		const { strategy } = mk();
		const Boom = () => {
			throw Symbol.for("ignite.o");
		};
		let thrown: unknown;
		try {
			strategy.render(jsx(Boom, {}));
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBe(Symbol.for("ignite.o"));
	});
	it("a setter that throws the owner symbol is contained and the walk continues", () => {
		class Thrower extends HTMLElement {
			set p(_v: unknown) {
				throw Symbol.for("ignite.o");
			}
		}
		customElements.define("x-v-throw", Thrower);
		const { strategy, root } = mk();
		strategy.render(
			jsx("x-v-throw", { p: 1, title: "t", children: jsx("i", {}) }),
		);
		const el = root.firstElementChild as HTMLElement;
		expect(el.getAttribute("title")).toBe("t");
		expect(el.children.length).toBe(1);
	});
});

describe("V4 committed state is explicit for fallback attributes", () => {
	let uid = 0;
	it("an upgraded setter replaces the fallback attribute on an updated key", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("foo", "bar"),
				fc.string({ minLength: 1 }),
				(key, v) => {
					const tag = `x-v-late${uid++}`;
					const log: unknown[] = [];
					const { strategy, root } = mk();
					strategy.render(jsx(tag, { [key]: "a" }));
					customElements.define(
						tag,
						class extends HTMLElement {
							constructor() {
								super();
								Object.defineProperty(this, key, {
									configurable: true,
									set: (x) => void log.push(x),
								});
							}
						},
					);
					const el = root.firstElementChild as Element;
					customElements.upgrade(el);
					strategy.render(jsx(tag, { [key]: v }));
					expect(el.getAttribute(key)).toBeNull();
					expect(log).toEqual([v]);
				},
			),
			{ seed: 169902, numRuns: 20 },
		);
	});
	it("removing the fallback forgets it, so a later null never calls the setter", () => {
		const tag = `x-v-late${uid++}`;
		const log: unknown[] = [];
		const { strategy, root } = mk();
		strategy.render(jsx(tag, { foo: "a" }));
		strategy.render(jsx(tag, {}));
		customElements.define(
			tag,
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "foo", {
						configurable: true,
						set: (x) => void log.push(x),
					});
				}
			},
		);
		customElements.upgrade(root.firstElementChild as Element);
		strategy.render(jsx(tag, { foo: null }));
		expect(log).toEqual([]);
	});
});

describe("V4b the fallback attribute is only removed when the renderer wrote it", () => {
	let uid = 0;
	const upgraded = (tag: string, reflect: boolean) =>
		customElements.define(
			tag,
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "foo", {
						configurable: true,
						set: (x) => {
							if (reflect && !this.hasAttribute("foo"))
								this.setAttribute("foo", String(x));
						},
					});
				}
			},
		);
	it("keeps an attribute the renderer never wrote", () => {
		const tag = `x-v-keep${uid++}`;
		const { strategy, root } = mk();
		strategy.render(jsx(tag, {}));
		const el = root.firstElementChild as Element;
		el.setAttribute("foo", "authored");
		upgraded(tag, false);
		customElements.upgrade(el);
		strategy.render(jsx(tag, { foo: 1 }));
		expect(el.getAttribute("foo")).toBe("authored");
	});
	it("keeps a reflection the setter made on later renders", () => {
		const tag = `x-v-refl${uid++}`;
		const { strategy, root } = mk();
		strategy.render(jsx(tag, { foo: 0 }));
		const el = root.firstElementChild as Element;
		upgraded(tag, true);
		customElements.upgrade(el);
		strategy.render(jsx(tag, { foo: 1 }));
		strategy.render(jsx(tag, { foo: 2 }));
		expect(el.getAttribute("foo")).toBe("1");
		strategy.render(jsx(tag, { foo: 3 }));
		expect(el.getAttribute("foo")).toBe("1");
	});
});

describe("V4c fallback state and attribute names", () => {
	let uid = 0;
	it("a null that wrote nothing leaves an authored attribute alone", () => {
		const tag = `x-v-null${uid++}`;
		const { strategy, root } = mk();
		strategy.render(jsx(tag, { foo: null }));
		const el = root.firstElementChild as Element;
		el.setAttribute("foo", "authored");
		customElements.define(
			tag,
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "foo", {
						configurable: true,
						set: () => undefined,
					});
				}
			},
		);
		customElements.upgrade(el);
		strategy.render(jsx(tag, { foo: 1 }));
		expect(el.getAttribute("foo")).toBe("authored");
	});
	it("removes the reflected attribute spelling of a camel-cased key", () => {
		const tag = `x-v-aria${uid++}`;
		const { strategy, root } = mk();
		strategy.render(jsx(tag, { ariaLabel: "a" }));
		const el = root.firstElementChild as Element;
		expect(el.getAttribute("aria-label")).toBe("a");
		customElements.define(
			tag,
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "ariaLabel", {
						configurable: true,
						set: () => undefined,
					});
				}
			},
		);
		customElements.upgrade(el);
		strategy.render(jsx(tag, { ariaLabel: "b" }));
		expect(el.getAttribute("aria-label")).toBeNull();
	});
});

describe("V4d a fallback marker follows the spelling that replaced it", () => {
	it("Foo then foo then Foo null never calls the never-set setter", () => {
		fc.assert(
			fc.property(fc.constantFrom(["Foo", "foo"], ["foo", "Foo"]), ([a, b]) => {
				const tag = `x-v-alias${uidAlias++}`;
				const log: unknown[] = [];
				const { strategy, root } = mk();
				strategy.render(jsx(tag, { [a as string]: "a" }));
				strategy.render(jsx(tag, { [b as string]: "b" }));
				strategy.render(jsx(tag, {}));
				customElements.define(
					tag,
					class extends HTMLElement {
						constructor() {
							super();
							Object.defineProperty(this, a as string, {
								configurable: true,
								set: (x) => void log.push(x),
							});
						}
					},
				);
				customElements.upgrade(root.firstElementChild as Element);
				strategy.render(jsx(tag, { [a as string]: null }));
				expect(log).toEqual([]);
			}),
			{ seed: 169912, numRuns: 4 },
		);
	});
});
let uidAlias = 0;

describe("V5 the handbook states the committed rule", () => {
	it("views.mdx limits the drop clear to committed non-nullish values", () => {
		const doc = readFileSync(
			resolve(
				__dirname,
				"../../../../../docs/site/src/content/docs/handbook/views.mdx",
			),
			"utf8",
		);
		expect(doc).not.toContain(
			"Dropping that prop calls the setter with `undefined`",
		);
		expect(doc).toContain("previously set non-nullish value");
	});
});

describe("V6 the structural scan covers constructors and the host bridge", () => {
	it("createElement goes through act and host sync is followed by a check", () => {
		const src = readFileSync(
			resolve(
				__dirname,
				"../../../../ignite-renderer/src/renderers/jsx/renderer.ts",
			),
			"utf8",
		);
		const lines = src.split("\n");
		const ctor = lines.filter(
			(l) =>
				/document\.createElement(NS)?\(/.test(l) && !l.trim().startsWith("//"),
		);
		expect(ctor).toEqual([]);
		lines.forEach((l, i) => {
			if (
				/\bsyncHostElement\(/.test(l) &&
				!l.includes("import") &&
				!/^\s*syncHostElement,/.test(l)
			)
				expect(lines.slice(i, i + 12).join("\n")).toMatch(/live\(\)/);
		});
	});
});
