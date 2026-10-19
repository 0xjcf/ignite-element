import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// Rules (PR #168, round 9):
//  D1 a blocked URL clears the sink an earlier render committed under ANY
//     spelling of the same attribute, not only the identical key.
//  D2 listener removals are drops and run with the drops; listener additions
//     are sets and run after every drop, so a dropped setter never reaches a
//     callback that is only being set in the same render.
//  D3 an own setter is dropped only when the previous render held a non-nullish
//     value for it: never-set props are not called, and a non-null -> nullish
//     -> absent sequence clears exactly once.

const log: unknown[] = [];
let onGone: (() => void) | null = null;
class Own extends HTMLElement {
	set p(v: unknown) {
		log.push(v);
	}
}
class Gone extends HTMLElement {
	set gone(v: unknown) {
		if (v === undefined) onGone?.();
	}
}
beforeAll(() => {
	customElements.define("x-d3", Own);
	customElements.define("x-d2", Gone);
});
afterEach(() => {
	log.length = 0;
	onGone = null;
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

describe("D1 a blocked URL clears a committed sink under another spelling", () => {
	it("any casing change to a blocked value leaves no URL attribute", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					["a", "href"],
					["img", "src"],
					["form", "action"],
					["a", "xlink:href"],
				),
				fc.constantFrom("lower", "upper", "title"),
				fc.constantFrom("lower", "upper", "title"),
				(pair, from, to) => {
					const [tag, name] = pair as [string, string];
					const spell = (k: string) =>
						k === "lower"
							? name
							: k === "upper"
								? name.toUpperCase()
								: name[0].toUpperCase() + name.slice(1);
					const { strategy, root } = mk();
					strategy.render(jsx(tag, { [spell(from)]: "/safe" }));
					strategy.render(jsx(tag, { [spell(to)]: "javascript:alert(1)" }));
					const el = root.firstElementChild as Element;
					expect(el.getAttribute(name)).toBeNull();
					expect(el.outerHTML.toLowerCase()).not.toContain("javascript:");
				},
			),
			{ seed: 169701, numRuns: 40 },
		);
	});
});

describe("D2 listener sets wait for every drop", () => {
	it("a dropped setter that dispatches never reaches the callback being set", () => {
		const { strategy, root } = mk();
		const first = () => {};
		let second = 0;
		strategy.render(jsx("x-d2", { onClick: first, gone: 1 }));
		const el = root.firstElementChild as HTMLElement;
		onGone = () => el.dispatchEvent(new Event("click"));
		strategy.render(jsx("x-d2", { onClick: () => void second++ }));
		expect(second).toBe(0);
		el.dispatchEvent(new Event("click"));
		expect(second).toBe(1);
	});
	it("a removed listener is gone before drops run", () => {
		const { strategy, root } = mk();
		let old = 0;
		strategy.render(jsx("x-d2", { onClick: () => void old++, gone: 1 }));
		const el = root.firstElementChild as HTMLElement;
		onGone = () => el.dispatchEvent(new Event("click"));
		strategy.render(jsx("x-d2", {}));
		expect(old).toBe(0);
	});
});

describe("D3 an own setter is dropped only after a committed value", () => {
	it("matches the committed-value model over any render sequence", () => {
		const state = fc.constantFrom("absent", "null", "undef", "one", "two");
		fc.assert(
			fc.property(fc.array(state, { minLength: 1, maxLength: 8 }), (seq) => {
				log.length = 0;
				document.body.replaceChildren();
				const { strategy } = mk();
				const expected: unknown[] = [];
				let committed = false;
				for (const s of seq) {
					const props: Record<string, unknown> = {};
					if (s === "null") props.p = null;
					if (s === "undef") props.p = undefined;
					if (s === "one") props.p = 1;
					if (s === "two") props.p = 2;
					strategy.render(jsx("x-d3", props));
					if (s === "one") expected.push(1);
					else if (s === "two") expected.push(2);
					else if (committed) expected.push(undefined);
					committed = s === "one" || s === "two";
				}
				expect(log).toEqual(expected);
			}),
			{ seed: 169703, numRuns: 80 },
		);
	});
});
