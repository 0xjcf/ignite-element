import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../renderers/jsx/renderer";

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

type Rec = { select: number; mount: number; update: number; dispose: number };
const hostFor = (rec: Rec, hooks: Partial<Record<keyof Rec, () => void>>) => ({
	select: (n: unknown) => {
		rec.select++;
		hooks.select?.();
		return n;
	},
	mount: (el: Element) => {
		rec.mount++;
		hooks.mount?.();
		const child = document.createElement("span");
		el.append(child);
		return { id: rec.mount };
	},
	update: () => {
		rec.update++;
		hooks.update?.();
	},
	dispose: () => {
		rec.dispose++;
	},
	describe: () => {
		rec.describe = (rec.describe ?? 0) + 1;
		return "d";
	},
});
type Rec2 = Rec & { describe?: number };

describe("V2 host callbacks are checked for supersession", () => {
	const run = (
		hooks: (root: HTMLElement) => Partial<Record<keyof Rec, () => void>>,
	) => {
		const rec: Rec2 = { select: 0, mount: 0, update: 0, dispose: 0 };
		const root = document.createElement("div");
		document.body.append(root);
		const supersede = () =>
			renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
		const host = hostFor(rec, hooks(root) as never);
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: { scene: host as never },
		};
		return { rec, root, supersede, hosts };
	};
	it("a select that supersedes stops the mount", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { select: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		expect(ctx.rec.mount).toBe(0);
	});
	it("a mount that supersedes disposes its handle and delivers nothing", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { mount: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		return Promise.resolve().then(() => {
			expect(ctx.rec.update).toBe(0);
			expect(ctx.rec.describe ?? 0).toBe(0);
			expect(ctx.rec.dispose).toBe(1);
		});
	});
	it("an update that supersedes stops the description", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { update: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		expect(ctx.rec.describe ?? 0).toBe(0);
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
				expect(lines.slice(i, i + 4).join("\n")).toMatch(/live\(\)/);
		});
	});
});
