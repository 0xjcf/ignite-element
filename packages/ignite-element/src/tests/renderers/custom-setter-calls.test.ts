import * as fc from "fast-check";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

type Call = [name: string, value: unknown];

const names = [
	"active",
	"checked",
	"defaultChecked",
	"selected",
	"defaultSelected",
] as const;
type Name = (typeof names)[number];

// Every own setter records each assignment, so a skipped or doubled write is
// observable even when the stored value does not change.
class CountingElement extends HTMLElement {
	calls: Call[] = [];
	stored: Partial<Record<Name, unknown>> = {};
}
for (const name of names) {
	Object.defineProperty(CountingElement.prototype, name, {
		get(this: CountingElement) {
			return this.stored[name];
		},
		set(this: CountingElement, value: unknown) {
			this.calls.push([name, value]);
			this.stored[name] = value;
		},
	});
}

beforeAll(() => {
	if (!customElements.get("x-counting")) {
		customElements.define("x-counting", CountingElement);
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
	const element = () => shadow.querySelector("x-counting") as CountingElement;
	return { strategy, element };
}

const view = (props: Record<string, unknown>): IgniteJsxChild =>
	jsx("x-counting", props);

function countsOf(calls: Call[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const [name] of calls) counts[name] = (counts[name] ?? 0) + 1;
	return counts;
}

describe("own custom setters", () => {
	it("an unchanged present prop is assigned again on every render", () => {
		const { strategy, element } = attach();
		strategy.render(view({ active: false }));
		strategy.render(view({ active: false }));
		strategy.render(view({ active: true }));
		strategy.render(view({ active: true }));
		expect(element().calls).toEqual([
			["active", false],
			["active", false],
			["active", true],
			["active", true],
		]);
	});

	it.each([
		["defaultChecked", "checked"],
		["defaultSelected", "selected"],
	] as const)(
		"%s false beside %s is assigned once each per render",
		(base, live) => {
			const { strategy, element } = attach();
			const props = { [base]: false, [live]: true };
			strategy.render(view(props));
			expect(countsOf(element().calls)).toEqual({ [base]: 1, [live]: 1 });
			expect(element().calls[element().calls.length - 1]).toEqual([live, true]);
			const before = element().calls.length;
			strategy.render(view(props));
			expect(countsOf(element().calls.slice(before))).toEqual({
				[base]: 1,
				[live]: 1,
			});
			expect(element().calls[element().calls.length - 1]).toEqual([live, true]);
		},
	);

	// Model: each render assigns every present non-nullish prop exactly once and
	// every dropped prop exactly once with undefined. Convergence: the stored
	// values equal a fresh element rendered with the final props.
	it("each present prop is assigned once per render and renders converge", () => {
		const valueArb = fc.constantFrom<unknown>(true, false, 0, 1, "a");
		const propsArb = fc.dictionary(fc.constantFrom(...names), valueArb);
		fc.assert(
			fc.property(
				fc.array(propsArb, { minLength: 1, maxLength: 6 }),
				(sequence) => {
					document.body.replaceChildren();
					const { strategy, element } = attach();
					let previous: Record<string, unknown> = {};
					for (const props of sequence) {
						const node = element();
						const start = node?.calls.length ?? 0;
						strategy.render(view(props));
						const calls = element().calls.slice(start);
						const expected: Record<string, number> = {};
						for (const name of Object.keys(props)) expected[name] = 1;
						for (const name of Object.keys(previous)) {
							if (!(name in props)) expected[name] = 1;
						}
						expect(countsOf(calls)).toEqual(expected);
						for (const [name, value] of calls) {
							expect(value).toBe(name in props ? props[name] : undefined);
						}
						previous = props;
					}
					const fresh = attach();
					fresh.strategy.render(view(sequence[sequence.length - 1]));
					expect(element().stored).toEqual(
						Object.fromEntries(
							Object.entries(fresh.element().stored).filter(
								([, v]) => v !== undefined,
							),
						),
					);
				},
			),
			{ seed: 168503, numRuns: 300 },
		);
	});
});
