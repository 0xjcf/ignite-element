import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Rule R2' (PR #168 threads on renderer.ts:1129 and :1145): once superseded,
// the WHOLE patch aborts. No further drops, sets, appends, removals,
// reorders or child walks, anywhere. Rule R3: an unchanged class value
// writes nothing.

const log: string[] = [];
class Probe extends HTMLElement {
	static hook: ((tag: string) => void) | null = null;
	set w(v: unknown) {
		log.push(`w:${String(v)}`);
	}
	get flag(): unknown {
		Probe.hook?.("g");
		return 1;
	}
	set d1(v: unknown) {
		if (v === undefined) Probe.hook?.("d1");
	}
	set d2(v: unknown) {
		log.push(`d2:${String(v)}`);
	}
	set value(v: unknown) {
		Probe.hook?.(`t${String(v)}`);
	}
	set trigger(v: unknown) {
		Probe.hook?.(`t${String(v)}`);
	}
}
let otherMount: typeof mountIgniteJsxOnce;
beforeAll(async () => {
	customElements.define("x-walk", Probe);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	Probe.hook = null;
	document.body.replaceChildren();
	log.length = 0;
});

// Writes to nodes the superseding event already detached are invisible to a
// MutationObserver on the root, so each old node is also compared by signature.
const oldNodes = (root: Node): Node[] => {
	const out: Node[] = [];
	const walk = document.createTreeWalker(root, 0x1 | 0x4);
	for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n);
	return out;
};
const sig = (n: Node): string =>
	n instanceof Element
		? `${n.outerHTML}:${[...n.attributes].map((a) => `${a.name}=${a.value}`).join(",")}:${n.childNodes.length}`
		: String(n.textContent);

describe("R2' a superseded patch aborts entirely", () => {
	it("zero writes after the event, whatever the walk position", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("grow", "shrink", "reorder", "same"),
				fc.boolean(),
				fc.integer({ min: 1, max: 4 }),
				fc.nat(),
				fc.constantFrom(
					"drop",
					"set",
					"value",
					"cleanup",
					"new",
					"replace",
					"new-value",
					"drop-last",
					"getter",
				),
				fc.constantFrom("detach", "mount-same", "mount-other"),
				(shape0, keyed, n, pick, hookKind, event) => {
					const shape =
						hookKind === "cleanup"
							? "shrink"
							: hookKind === "new" || hookKind === "new-value"
								? "grow"
								: hookKind === "replace"
									? "same"
									: shape0;
					document.body.replaceChildren();
					log.length = 0;
					const hookAt = pick % n;
					const host = document.createElement("div");
					document.body.appendChild(host);
					const shadow = host.attachShadow({ mode: "open" });
					const strategy = createIgniteJsxRenderStrategy();
					strategy.attach(shadow);
					const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
					const ids = Array.from(
						{ length: shape === "shrink" ? n + 1 : n },
						(_, i) => i,
					);
					const view = (gen: number): IgniteJsxChild => {
						let list = ids.slice();
						if (gen === 1) {
							if (shape === "grow") list = [...list, n, n + 1];
							if (shape === "shrink") list = list.slice(0, -1);
							if (shape === "reorder") list = list.reverse();
						}
						return jsx("section", {
							children: list.map((i) => {
								const props: Record<string, unknown> = {
									w: `${gen}.${i}`,
									"data-g": String(gen),
								};
								if (gen === 0) {
									props.d1 = 1;
									props.d2 = 1;
									if (hookKind === "getter") props.flag = 1;
									if (
										(hookKind === "cleanup" && i === n) ||
										(hookKind === "replace" && i === hookAt)
									) {
										props.ref = () => () => Probe.hook?.("c");
									}
								} else if (hookKind === "set" && i === hookAt) {
									props.trigger = i;
								} else if (hookKind === "value" && i === hookAt) {
									props.value = i;
								} else if (hookKind === "new" && i === n) {
									props.trigger = i;
								} else if (hookKind === "new-value" && i === n) {
									props.value = i;
								}
								// The last walked position of the drop loop: only the setter
								// that supersedes, nothing after it on this node.
								const bare = hookKind === "drop-last" && i === hookAt;
								if (bare) {
									for (const k of Object.keys(props)) delete props[k];
									if (gen === 0) props.d1 = 1;
								}
								const replaced =
									hookKind === "replace" && gen === 0 && i === hookAt;
								if (
									hookKind === "replace" &&
									gen === 1 &&
									i === hookAt &&
									!keyed &&
									pick % 2 === 1
								) {
									return `r${gen}`;
								}
								return jsx(
									replaced ? "div" : "x-walk",
									{
										// children first, so a trigger prop is the last key walked
										children:
											pick % 3 === 0 || bare
												? []
												: [`t${gen}.${i}`, jsx("b", { children: `b${gen}` })],
										...props,
									},
									keyed ? i : undefined,
								);
							}),
						});
					};
					strategy.render(view(0));
					const obs = new MutationObserver(() => {});
					obs.observe(root, {
						attributes: true,
						characterData: true,
						childList: true,
						subtree: true,
					});
					// A getter-only prop leaves no attribute, so plant one the drop would erase.
					if (hookKind === "getter") {
						for (const e of root.querySelectorAll("x-walk")) {
							e.setAttribute("flag", "1");
						}
					}
					const before = oldNodes(root);
					let atEvent: string[] = [];
					let fired = false;
					let logAtEvent = -1;
					const want =
						hookKind === "drop" || hookKind === "drop-last"
							? "d1"
							: hookKind === "getter"
								? "g"
								: hookKind === "cleanup" || hookKind === "replace"
									? "c"
									: `t${hookKind === "new" || hookKind === "new-value" ? n : hookAt}`;
					Probe.hook = (tag) => {
						if (fired || tag !== want) return;
						fired = true;
						if (event === "detach") strategy.detach();
						else
							(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
								root,
								jsx("p", { "data-m": "1" }),
							);
						obs.takeRecords();
						logAtEvent = log.length;
						atEvent = before.map(sig);
					};
					log.length = 0;
					strategy.render(view(1));
					expect(fired).toBe(true);
					expect(before.map(sig)).toEqual(atEvent);
					expect(log.slice(logAtEvent)).toEqual([]);
					expect(obs.takeRecords().length).toBe(0);
					obs.disconnect();
				},
			),
			{ seed: 169101, numRuns: 500 },
		);
	});
});

describe("R3 an unchanged class value writes nothing", () => {
	it("repeated renders of the same class or className record no mutation", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("class", "className"),
				fc.constantFrom("a", "a b", "x-y z"),
				fc.constantFrom("div", "x-walk-cls"),
				fc.integer({ min: 1, max: 4 }),
				(key, value, tag, runs) => {
					document.body.replaceChildren();
					const host = document.createElement("div");
					document.body.appendChild(host);
					const shadow = host.attachShadow({ mode: "open" });
					const strategy = createIgniteJsxRenderStrategy();
					strategy.attach(shadow);
					const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
					const view = () => jsx(tag, { [key]: value, children: "x" });
					strategy.render(view());
					const obs = new MutationObserver(() => {});
					obs.observe(root, { attributes: true, subtree: true });
					for (let i = 0; i < runs; i++) strategy.render(view());
					expect(obs.takeRecords().length).toBe(0);
					obs.disconnect();
				},
			),
			{ seed: 169002, numRuns: 60 },
		);
	});
});

describe("R3 an unchanged style object writes nothing", () => {
	it("rendering equal style objects records no mutation", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
		const view = () =>
			jsx("div", { style: { color: "red", marginTop: "2px" }, children: "x" });
		strategy.render(view());
		const obs = new MutationObserver(() => {});
		obs.observe(root, { attributes: true, subtree: true });
		strategy.render(view());
		expect(obs.takeRecords().length).toBe(0);
		expect((root.firstElementChild as HTMLElement).style.color).toBe("red");
		obs.disconnect();
	});
});

describe("R2' the keyed reorder stops too", () => {
	it("a late own setter on the last walked child leaves the old order alone", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
		const item = (id: number, extra: Record<string, unknown> = {}) =>
			jsx("x-walk", extra, id);
		strategy.render(jsx("section", { children: [item(1), item(2), item(3)] }));
		const section = root.firstElementChild as HTMLElement;
		const order = () => [...section.children].map((c) => c.localName).length;
		const before = section.innerHTML;
		let fired = false;
		Probe.hook = (tag) => {
			if (tag !== "t1") return;
			fired = true;
			strategy.detach();
		};
		const keys = () => [...section.children];
		const first = keys();
		strategy.render(
			jsx("section", { children: [item(3), item(2), item(1, { value: 1 })] }),
		);
		expect(fired).toBe(true);
		expect(keys()).toEqual(first);
		expect(section.innerHTML).toBe(before);
		expect(order()).toBe(3);
	});
});

// Rule U (PR #168 thread on renderer.ts:1442): when an element gains an own
// setter for a key after the renderer wrote that key as an attribute, a later
// drop clears the stale attribute too, so it matches a fresh render.
describe("U pre-upgrade attributes are cleared once the element gains a setter", () => {
	let uid = 0;
	const render = (tag: string, props: Record<string, unknown>) => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		return {
			strategy,
			el: () => shadow.querySelector(tag) as HTMLElement,
			view: (p: Record<string, unknown>) => jsx(tag, p),
			props,
		};
	};
	it("drops the attribute written before the definition existed", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("foo", "bar", "mode", "label"),
				fc.constantFrom("a", "1", "x y"),
				fc.constantFrom("keep", "other"),
				(key, value, kept) => {
					const tag = `x-up${uid++}`;
					const r = render(tag, {});
					r.strategy.render(r.view({ [key]: value, [kept]: "k" }));
					const calls: unknown[] = [];
					customElements.define(
						tag,
						class extends HTMLElement {
							constructor() {
								super();
								Object.defineProperty(this, key, {
									set: (v) => calls.push(v),
									configurable: true,
								});
							}
						},
					);
					customElements.upgrade(r.el());
					r.strategy.render(r.view({ [kept]: "k" }));
					const fresh = render(tag, {});
					fresh.strategy.render(fresh.view({ [kept]: "k" }));
					expect(r.el().hasAttribute(key)).toBe(false);
					expect(r.el().outerHTML).toBe(fresh.el().outerHTML);
				},
			),
			{ seed: 169102, numRuns: 40 },
		);
	});
});
