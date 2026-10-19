import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Rule R2 (PR #168 thread on renderer.ts:130): once superseded, a render
// performs NO further DOM writes, including the remaining props and children
// of the tree it is walking. Only the superseding render writes.

const log: string[] = [];
class Probe extends HTMLElement {
	static hook: ((id: number) => void) | null = null;
	set w(v: unknown) {
		log.push(`w:${String(v)}`);
	}
	set trigger(v: unknown) {
		Probe.hook?.(Number(v));
	}
}
let otherMount: typeof mountIgniteJsxOnce;
beforeAll(async () => {
	customElements.define("x-probe", Probe);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
});
afterEach(() => {
	Probe.hook = null;
	document.body.replaceChildren();
	log.length = 0;
});

type Tree = { kids: Tree[] };
const treeArb: fc.Arbitrary<Tree> = fc.letrec<{ t: Tree; leaf: Tree }>(
	(tie) => ({
		leaf: fc.constant({ kids: [] }),
		t: fc.oneof(
			{ depthSize: "small", maxDepth: 3 },
			tie("leaf"),
			fc.record({ kids: fc.array(tie("t"), { minLength: 1, maxLength: 3 }) }),
		),
	}),
).t;

function count(t: Tree): number {
	return 1 + t.kids.reduce((n, k) => n + count(k), 0);
}

describe("R2 a superseded render stops walking", () => {
	it("no setter call or DOM mutation follows the superseding event (write-log oracle)", () => {
		fc.assert(
			fc.property(
				treeArb,
				fc.nat(),
				fc.constantFrom("first", "last"),
				fc.constantFrom("detach", "mount-same", "mount-other"),
				fc.boolean(),
				(tree, pick, propPos, kind, withText) => {
					document.body.replaceChildren();
					log.length = 0;
					const total = count(tree);
					const hookIdx = pick % total;
					const host = document.createElement("div");
					document.body.appendChild(host);
					const shadow = host.attachShadow({ mode: "open" });
					const strategy = createIgniteJsxRenderStrategy();
					strategy.attach(shadow);
					const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
					let armed = false;
					let fired = false;
					const view = (gen: number): IgniteJsxChild => {
						let idx = 0;
						const build = (t: Tree): IgniteJsxChild => {
							const me = idx++;
							const props: Record<string, unknown> = {};
							const isHook = me === hookIdx;
							if (isHook && propPos === "first") props.trigger = me;
							props.w = `${gen}.${me}`;
							props["data-g"] = String(gen);
							if (isHook && propPos === "last") props.trigger = me;
							const children: IgniteJsxChild[] = t.kids.map(build);
							if (withText) children.push(`t${gen}.${me}`);
							return jsx("x-probe", { ...props, children });
						};
						return build(tree);
					};
					strategy.render(view(0));
					const obs = new MutationObserver(() => {});
					obs.observe(root, {
						attributes: true,
						characterData: true,
						childList: true,
						subtree: true,
					});
					let logAtEvent = -1;
					Probe.hook = (id) => {
						if (!armed || fired || id !== hookIdx) return;
						fired = true;
						if (kind === "detach") strategy.detach();
						else
							(kind === "mount-same" ? mountIgniteJsxOnce : otherMount)(
								root,
								jsx("section", { "data-m": "1" }),
							);
						obs.takeRecords();
						logAtEvent = log.length;
					};
					armed = true;
					log.length = 0;
					// The trigger sits on a node only for the update render, so the
					// first render stays quiet.
					strategy.render(view(1));
					expect(fired).toBe(true);
					expect(log.slice(logAtEvent)).toEqual([]);
					expect(obs.takeRecords().length).toBe(0);
					obs.disconnect();
				},
			),
			{ seed: 168901, numRuns: 120 },
		);
	});
});
