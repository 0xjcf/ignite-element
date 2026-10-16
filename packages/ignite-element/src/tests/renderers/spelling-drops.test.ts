import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";

// An own setter that reflects to an attribute shares that attribute with
// differently cased spellings. Dropping an old spelling must never erase what
// a newly applied spelling wrote, whichever order the keys were switched in.
class ReflectingElement extends HTMLElement {
	private stored: unknown;
	get id(): string {
		return String(this.stored ?? "");
	}
	set id(value: unknown) {
		this.stored = value;
		if (value === undefined || value === null) this.removeAttribute("id");
		else this.setAttribute("id", String(value));
	}
}

beforeAll(() => {
	if (!customElements.get("x-reflect")) {
		customElements.define("x-reflect", ReflectingElement);
	}
});
afterEach(() => {
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
const element = (shadow: ShadowRoot) =>
	shadow.querySelector("x-reflect") as HTMLElement;
const attributes = (el: HTMLElement) =>
	Array.from(el.attributes)
		.map((a) => `${a.name}=${a.value}`)
		.sort()
		.join(",");

describe("differently cased spellings of a reflected attribute", () => {
	it("a new exact-case setter keeps the attribute it reflects after an old spelling is dropped", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("x-reflect", { ID: "old" }));
		expect(element(shadow).getAttribute("id")).toBe("old");
		strategy.render(jsx("x-reflect", { id: "new" }));
		expect(element(shadow).getAttribute("id")).toBe("new");
	});

	it("an old setter spelling does not erase the attribute a new spelling wrote", () => {
		const { shadow, strategy } = attach();
		strategy.render(jsx("x-reflect", { id: "old" }));
		strategy.render(jsx("x-reflect", { ID: "new" }));
		expect(element(shadow).getAttribute("id")).toBe("new");
	});

	it("any sequence of spelling switches equals a fresh render of the final props", () => {
		const spellings = ["id", "ID", "Id", "iD"] as const;
		const propsArb = fc.oneof(
			fc.constant({}),
			fc
				.tuple(
					fc.uniqueArray(fc.constantFrom(...spellings), {
						minLength: 1,
						maxLength: 1,
					}),
					fc.constantFrom("a", "b", "c"),
				)
				.map(([[key], value]) => ({ [key]: value })),
		);
		fc.assert(
			fc.property(
				fc.array(propsArb, { minLength: 1, maxLength: 6 }),
				(sequence) => {
					document.body.replaceChildren();
					const { shadow, strategy } = attach();
					for (const props of sequence) {
						strategy.render(jsx("x-reflect", props));
					}
					const final = sequence[sequence.length - 1];
					const reference = attach();
					reference.strategy.render(jsx("x-reflect", final));
					expect(attributes(element(shadow))).toBe(
						attributes(element(reference.shadow)),
					);
				},
			),
			{ seed: 168506, numRuns: 400 },
		);
	});
});
