import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Rule R (PR #168 threads on renderer.ts:1535 and :1546): any newer commit or
// detach on a root supersedes the older in-flight work at EVERY phase (patch,
// controlled flush, refs). The supersession state is shared across bundled
// copies of the renderer, like the mount mark.

class Hook extends HTMLElement {
	static hook: (() => void) | null = null;
	set trigger(_v: unknown) {
		Hook.hook?.();
	}
}
let otherMount: typeof mountIgniteJsxOnce;
beforeAll(async () => {
	customElements.define("x-ss-hook", Hook);
	vi.resetModules();
	otherMount = (await import("../../renderers/jsx/IgniteJsxRenderStrategy"))
		.mountIgniteJsxOnce;
	expect(otherMount).not.toBe(mountIgniteJsxOnce);
});
afterEach(() => {
	Hook.hook = null;
	document.body.replaceChildren();
});

const nativeValue = Object.getOwnPropertyDescriptor(
	HTMLInputElement.prototype,
	"value",
) as PropertyDescriptor;

type Phase = "patch" | "flush" | "ref";
type Kind = "detach" | "mount-same" | "mount-other";

function scenario(phase: Phase, kind: Kind) {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	const root = shadow.querySelector("ignite-jsx-root") as HTMLElement;
	const events: string[] = [];
	let fired = false;
	let armed = false;
	const fire = () => {
		if (fired || !armed) return;
		fired = true;
		events.push("EVENT");
		if (kind === "detach") strategy.detach();
		else
			(kind === "mount-same" ? mountIgniteJsxOnce : otherMount)(
				root,
				jsx("section", { "data-m": "1" }),
			);
	};
	const view = (n: number, extra: boolean) =>
		jsx("div", {
			children: [
				jsx("x-ss-hook", { trigger: n }),
				jsx("input", {
					value: `a${n}`,
					ref: (el: Element | null) => {
						if (el) events.push("ref:a");
						if (phase === "ref" && el) fire();
					},
				}),
				jsx("input", {
					value: `b${n}`,
					ref: (el: Element | null) => el && events.push("ref:b"),
				}),
				...(extra
					? [
							jsx("p", {
								ref: (el: Element | null) => el && events.push("ref:p"),
							}),
						]
					: []),
			],
		});
	strategy.render(view(0, false));
	const [first, second] = Array.from(
		shadow.querySelectorAll("input"),
	) as HTMLInputElement[];
	const spy = (el: HTMLInputElement, name: string) =>
		Object.defineProperty(el, "value", {
			configurable: true,
			get() {
				return nativeValue.get?.call(this);
			},
			set(v: string) {
				events.push(`write:${name}`);
				nativeValue.set?.call(this, v);
				if (phase === "flush" && name === "first") fire();
			},
		});
	spy(first, "first");
	spy(second, "second");
	events.length = 0;
	armed = true;
	if (phase === "patch") Hook.hook = fire;
	strategy.render(view(1, true));
	Hook.hook = null;
	return { events, fired: () => fired };
}

describe("R supersession reaches every phase, same copy and across copies", () => {
	it("nothing from the superseded render runs after the event (write-log oracle)", () => {
		fc.assert(
			fc.property(
				fc.constantFrom<Phase>("patch", "flush", "ref"),
				fc.constantFrom<Kind>("detach", "mount-same", "mount-other"),
				(phase, kind) => {
					document.body.replaceChildren();
					const { events, fired } = scenario(phase, kind);
					expect(fired()).toBe(true);
					const after = events.slice(events.indexOf("EVENT") + 1);
					expect(after).toEqual([]);
				},
			),
			{ seed: 168801, numRuns: 30 },
		);
	});
	it("a later plain render after a mount from another copy still converges", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const shadow = host.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		strategy.render(jsx("p", { children: "a" }));
		otherMount(
			shadow.querySelector("ignite-jsx-root") as HTMLElement,
			jsx("em", { children: "m" }),
		);
		strategy.render(jsx("p", { children: "z" }));
		expect(shadow.querySelector("ignite-jsx-root")?.innerHTML).toBe("<p>z</p>");
	});
});
