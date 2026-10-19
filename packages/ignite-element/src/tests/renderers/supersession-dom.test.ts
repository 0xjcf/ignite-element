import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { createDomNode } from "../../renderers/jsx/renderer";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Rules (PR #168, threads on renderer.ts:64 and :1255):
//  R-dom: after ANY operation that can run user code, including DOM operations
//         on custom elements (attributeChangedCallback on setAttribute or a
//         style write, connectedCallback on append, disconnectedCallback on
//         removal), ownership is rechecked before the next write.
//  R-detached: a detached root under construction owns its commit too; once a
//         newer mount replaces it, no later phase runs on the retired nodes.

let hook: ((tag: string) => void) | null = null;
class Cb extends HTMLElement {
	static observedAttributes = ["data-z", "class"];
	attributeChangedCallback(
		name: string,
		_old: string | null,
		v: string | null,
	) {
		if (v === null) return;
		if (name === "data-z") hook?.(`a${v}`);
		if (name === "class") hook?.(`s${this.getAttribute("data-id")}`);
	}
	connectedCallback() {
		if (this.getAttribute("data-g") === "1") {
			hook?.(`k${this.getAttribute("data-id")}`);
		}
	}
	disconnectedCallback() {
		hook?.(`x${this.getAttribute("data-id")}`);
	}
}
let otherMount: typeof mountIgniteJsxOnce;
beforeAll(async () => {
	customElements.define("x-cb", Cb);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	hook = null;
	document.body.replaceChildren();
});

const oldNodes = (root: Node): Node[] => {
	const out: Node[] = [];
	const walk = document.createTreeWalker(root, 0x1 | 0x4);
	for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n);
	return out;
};
const sig = (n: Node): string =>
	n instanceof Element
		? `${n.outerHTML}:${[...n.attributes].map((a) => `${a.name}=${a.value}`).join(",")}`
		: String(n.textContent);

describe("R-dom custom element DOM operations are user-code calls", () => {
	it("no write follows a remount triggered by a callback, whatever its position", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("attr", "class", "connected", "disconnected"),
				fc.constantFrom("grow", "shrink", "same"),
				fc.boolean(),
				fc.integer({ min: 1, max: 3 }),
				fc.constantFrom("mount-same", "mount-other", "detach"),
				(kind, shape0, keyed, n, event) => {
					const shape =
						kind === "disconnected"
							? "shrink"
							: kind === "connected"
								? "grow"
								: shape0;
					document.body.replaceChildren();
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
					const hookId =
						kind === "connected" || kind === "disconnected" ? n : 0;
					const view = (gen: number): IgniteJsxChild => {
						let list = ids.slice();
						if (gen === 1 && shape === "grow") list = [...list, n, n + 1];
						if (gen === 1 && shape === "shrink") list = list.slice(0, -1);
						return jsx("section", {
							children: list.map((i) => {
								// The trigger prop is the final one walked on its node.
								const props: Record<string, unknown> = {
									"data-id": String(i),
									"data-g": String(gen),
								};
								if (gen === 1 && i === hookId && kind === "attr")
									props["data-z"] = String(i);
								if (gen === 1 && i === hookId && kind === "class")
									props.class = "c";
								return jsx("x-cb", { ...props }, keyed ? i : undefined);
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
					const before = oldNodes(root);
					let atEvent: string[] = [];
					let fired = false;
					const want =
						kind === "attr"
							? `a${hookId}`
							: kind === "class"
								? `s${hookId}`
								: kind === "connected"
									? `k${hookId}`
									: `x${hookId}`;
					hook = (tag) => {
						if (fired || tag !== want) return;
						fired = true;
						if (event === "detach") strategy.detach();
						else
							(event === "mount-same" ? mountIgniteJsxOnce : otherMount)(
								root,
								jsx("p", { "data-m": "1" }),
							);
						obs.takeRecords();
						atEvent = before.map(sig);
					};
					strategy.render(view(1));
					expect(fired).toBe(true);
					expect(before.map(sig)).toEqual(atEvent);
					expect(obs.takeRecords().length).toBe(0);
					if (event !== "detach") {
						expect(root.childNodes.length).toBe(1);
						expect((root.firstElementChild as Element).localName).toBe("p");
					}
					obs.disconnect();
				},
			),
			{ seed: 169202, numRuns: 300 },
		);
	});
});

describe("R-detached createDomNode commits own their root", () => {
	let calls: Element[] = [];
	let refs: Element[] = [];
	const proto = HTMLInputElement.prototype;
	const desc = Object.getOwnPropertyDescriptor(
		proto,
		"value",
	) as PropertyDescriptor;
	afterEach(() => {
		Object.defineProperty(proto, "value", desc);
		calls = [];
		refs = [];
	});
	it("stops later controlled writes and refs once the root is replaced", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 2, max: 4 }),
				fc.nat(),
				fc.boolean(),
				fc.boolean(),
				(k, pick, asFragment, other) => {
					calls = [];
					refs = [];
					const trigger = pick % k;
					let fired = false;
					let afterEvent = 0;
					let refsAfter = 0;
					Object.defineProperty(proto, "value", {
						...desc,
						set(this: HTMLInputElement, v: string) {
							calls.push(this);
							if (fired) afterEvent++;
							if (!fired && calls.length === trigger + 1) {
								fired = true;
								(other ? otherMount : mountIgniteJsxOnce)(
									this.getRootNode() as ParentNode,
									jsx("p", { children: "new" }),
								);
							}
							desc.set?.call(this, v);
						},
					});
					const inputs = Array.from({ length: k }, (_, i) =>
						jsx("input", {
							value: `v${i}`,
							ref: (el: Element) => {
								refs.push(el);
								if (fired) refsAfter++;
							},
						}),
					);
					const view = asFragment ? inputs : jsx("div", { children: inputs });
					createDomNode(view);
					expect(fired).toBe(true);
					expect(afterEvent).toBe(0);
					expect(refsAfter).toBe(0);
				},
			),
			{ seed: 169201, numRuns: 80 },
		);
	});
});
