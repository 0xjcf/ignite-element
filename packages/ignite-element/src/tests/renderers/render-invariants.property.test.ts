import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import type { IgniteJsxChild } from "../../renderers/jsx/types";

// Reproduce a failure with FAST_CHECK_SEED=<seed printed by fast-check>.
// Runs are capped so the default suite stays fast; raise them with
// FAST_CHECK_NUM_RUNS for a deeper local sweep.
const seed = Number(process.env.FAST_CHECK_SEED ?? 168401);
const numRuns = Number(process.env.FAST_CHECK_NUM_RUNS ?? 150);

afterEach(() => {
	document.body.replaceChildren();
});

type Tag = "div" | "input";
type Props = Record<string, unknown>;

// One family is one underlying sink written through several spellings. A
// render passes at most one spelling per family; two at once are unspecified.
// A tabIndex of 0 is left out: a fresh element already reads 0, so a fresh
// render writes no attribute where an update from 1 to 0 does. The state is
// equal; only the redundant attribute differs.
type Family = {
	name: string;
	spellings: string[];
	// Exact spellings are IDL properties; the rest are attributes.
	exact: string[];
	value(spelling: string): fc.Arbitrary<unknown>;
};

const attributeValue = fc.constantFrom("m", "n", "o");
const families: Family[] = [
	{
		name: "id",
		spellings: ["id", "ID", "Id"],
		exact: ["id"],
		value: () => attributeValue,
	},
	{
		name: "title",
		spellings: ["title", "TITLE"],
		exact: ["title"],
		value: () => attributeValue,
	},
	{
		name: "data",
		spellings: ["data-x", "DATA-X"],
		exact: [],
		value: () => attributeValue,
	},
	{
		name: "aria",
		spellings: ["aria-label", "ariaLabel"],
		exact: [],
		value: () => attributeValue,
	},
	{
		name: "class",
		spellings: ["class", "className", "CLASS"],
		exact: [],
		value: () => attributeValue,
	},
	{
		name: "scrollTop",
		spellings: ["scrollTop", "SCROLLTOP"],
		exact: ["scrollTop"],
		value: (s) =>
			s === "scrollTop" ? fc.integer({ min: 1, max: 50 }) : attributeValue,
	},
	{
		name: "scrollLeft",
		spellings: ["scrollLeft", "SCROLLLEFT"],
		exact: ["scrollLeft"],
		value: (s) =>
			s === "scrollLeft" ? fc.integer({ min: 1, max: 50 }) : attributeValue,
	},
	{
		name: "indeterminate",
		spellings: ["indeterminate", "INDETERMINATE"],
		exact: ["indeterminate"],
		value: (s) => (s === "indeterminate" ? fc.constant(true) : attributeValue),
	},
	{
		name: "tabIndex",
		spellings: ["tabIndex", "tabindex", "TABINDEX"],
		exact: ["tabIndex"],
		value: (s) =>
			s === "tabIndex"
				? fc.integer({ min: 1, max: 5 })
				: fc.constantFrom("1", "2"),
	},
];

const familyProp = (family: Family) =>
	fc
		.constantFrom(...family.spellings)
		.chain((spelling) =>
			family.value(spelling).map((value) => [spelling, value] as const),
		);

// Each family is absent or present in one spelling and value.
const propsArb: fc.Arbitrary<Props> = fc
	.tuple(
		...families.map((family) =>
			fc.option(familyProp(family), { nil: undefined }),
		),
	)
	.map((entries) =>
		Object.fromEntries(entries.filter((entry) => entry !== undefined)),
	);

function attach(tag: Tag) {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const strategy = createIgniteJsxRenderStrategy();
	strategy.attach(shadow);
	const view = (props: Props, extra: Props = {}): IgniteJsxChild =>
		jsx(tag, { ...props, ...extra });
	return { shadow, strategy, view };
}

// State a user can observe: attributes and the exact-name properties. Attribute
// order is not state.
function observe(shadow: ShadowRoot): string {
	const element = shadow.querySelector("ignite-jsx-root")?.firstElementChild;
	if (!element) return "<empty>";
	const attributes = Array.from(element.attributes)
		.map((attribute) => `${attribute.name}=${attribute.value}`)
		.sort();
	const properties = [
		"scrollTop",
		"scrollLeft",
		"indeterminate",
		"tabIndex",
	].map((key) => `${key}:${String(Reflect.get(element, key))}`);
	return [...attributes, ...properties].join("|");
}

function fresh(tag: Tag, props: Props): string {
	const { shadow, strategy, view } = attach(tag);
	strategy.render(view(props));
	return observe(shadow);
}

const tagArb = fc.constantFrom<Tag>("div", "input");

describe("renderer invariants", () => {
	it("any render sequence ends equal to a fresh render of the final props", () => {
		fc.assert(
			fc.property(
				tagArb,
				fc.array(propsArb, { minLength: 1, maxLength: 6 }),
				(tag, sequence) => {
					const { shadow, strategy, view } = attach(tag);
					for (const props of sequence) strategy.render(view(props));
					expect(observe(shadow)).toBe(
						fresh(tag, sequence[sequence.length - 1]),
					);
				},
			),
			{ seed, numRuns },
		);
	});

	it("dropping a prop restores the default of every sink", () => {
		const present = propsArb.filter((props) => Object.keys(props).length > 0);
		fc.assert(
			fc.property(tagArb, present, (tag, props) => {
				const { shadow, strategy, view } = attach(tag);
				strategy.render(view(props));
				strategy.render(view({}));
				expect(observe(shadow)).toBe(fresh(tag, {}));
			}),
			{ seed, numRuns },
		);
	});

	it("case-variant respellings leave only the final spelling's state", () => {
		fc.assert(
			fc.property(
				tagArb,
				fc
					.constantFrom(...families)
					.chain((family) =>
						fc
							.tuple(
								fc.constantFrom(...family.spellings),
								fc.constantFrom(...family.spellings),
							)
							.chain(([first, second]) =>
								fc.tuple(
									fc.constant(first),
									family.value(first),
									fc.constant(second),
									family.value(second),
								),
							),
					),
				(tag, [first, firstValue, second, secondValue]) => {
					const { shadow, strategy, view } = attach(tag);
					strategy.render(view({ [first]: firstValue }));
					strategy.render(view({ [second]: secondValue }));
					expect(observe(shadow)).toBe(fresh(tag, { [second]: secondValue }));
				},
			),
			{ seed, numRuns },
		);
	});

	// Model: the newest requested props. Real: one strategy. A nested render
	// is issued from a ref while the outer commit is still running.
	it("render commands, including reentrant ones, converge on the newest view", () => {
		type Model = { expected: Props; renders: number };
		type Real = {
			tag: Tag;
			shadow: ShadowRoot;
			strategy: ReturnType<typeof createIgniteJsxRenderStrategy>;
			view: (props: Props, extra?: Props) => IgniteJsxChild;
		};
		class RenderCommand implements fc.Command<Model, Real> {
			constructor(readonly props: Props) {}
			check = () => true;
			run(model: Model, real: Real) {
				real.strategy.render(real.view(this.props));
				model.expected = this.props;
				model.renders++;
			}
			toString = () => `render(${JSON.stringify(this.props)})`;
		}
		class ReentrantRenderCommand implements fc.Command<Model, Real> {
			constructor(
				readonly outer: Props,
				readonly inner: Props,
			) {}
			check = () => true;
			run(model: Model, real: Real) {
				let nested = false;
				real.strategy.render(
					real.view(this.outer, {
						ref: () => {
							if (nested) return;
							nested = true;
							real.strategy.render(real.view(this.inner));
						},
					}),
				);
				model.expected = this.inner;
				model.renders++;
			}
			toString = () =>
				`reentrant(${JSON.stringify(this.outer)} -> ${JSON.stringify(this.inner)})`;
		}
		const commands = fc.commands<Model, Real>(
			[
				propsArb.map((props) => new RenderCommand(props)),
				fc
					.tuple(propsArb, propsArb)
					.map(([outer, inner]) => new ReentrantRenderCommand(outer, inner)),
			],
			{ maxCommands: 8 },
		);
		fc.assert(
			fc.property(tagArb, commands, (tag, cmds) => {
				const { shadow, strategy, view } = attach(tag);
				const real: Real = {
					tag,
					shadow,
					strategy,
					view,
				};
				const model: Model = { expected: {}, renders: 0 };
				fc.modelRun(() => ({ model, real }), cmds);
				if (model.renders > 0) {
					expect(observe(shadow)).toBe(fresh(tag, model.expected));
				}
			}),
			{ seed, numRuns },
		);
	});
});
