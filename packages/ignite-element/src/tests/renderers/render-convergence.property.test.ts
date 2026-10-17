import * as fc from "fast-check";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

// Safety tests say a blocked value is never written. Convergence says the DOM
// after any sequence of renders equals a fresh render of the final props.
// Reproduce with FAST_CHECK_SEED=<seed>.
const seed = Number(process.env.FAST_CHECK_SEED ?? 168501);
const numRuns = Number(process.env.FAST_CHECK_NUM_RUNS ?? 300);

type Props = Record<string, unknown>;

class ConvergeElement extends HTMLElement {
	// Setters reflect to an attribute so a skipped assignment is observable
	// even when the backing field already holds the assigned value.
	private _active = false;
	private _count = 0;
	get active(): boolean {
		return this._active;
	}
	set active(value: boolean) {
		this._active = value ?? false;
		this.reflect("data-active-set", value);
	}
	get count(): number {
		return this._count;
	}
	set count(value: number) {
		this._count = Number(value ?? 0);
		this.reflect("data-count-set", value);
	}
	private reflect(name: string, value: unknown): void {
		if (value === undefined) this.removeAttribute(name);
		else this.setAttribute(name, String(value));
	}
}

beforeAll(() => {
	if (!customElements.get("x-converge")) {
		customElements.define("x-converge", ConvergeElement);
	}
});

beforeEach(() => {
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

const smilValue = fc.constantFrom(
	"10",
	"1",
	"#a;#b",
	"javascript:alert(1)",
	" JaVa\tScript:x",
);
const smilTarget = fc.constantFrom(
	"href",
	"xlink:href",
	" HREF",
	"width",
	"fill",
	7,
);

type Kind = {
	name: string;
	view(props: Props): ReturnType<typeof jsx>;
	props: fc.Arbitrary<Props>;
	read(element: Element): unknown;
};

function record(
	shape: Record<string, fc.Arbitrary<unknown>>,
	required: string[] = [],
): fc.Arbitrary<Props> {
	return fc.record(shape, { requiredKeys: required }).chain((value) =>
		fc
			.shuffledSubarray(Object.keys(value), {
				minLength: Object.keys(value).length,
			})
			.map((keys) =>
				Object.fromEntries(keys.map((key) => [key, (value as Props)[key]])),
			),
	);
}

const smil = (tag: string): Kind => ({
	name: tag,
	view: (props) =>
		jsx("svg", { children: jsx("a", { children: jsx(tag, props) }) }),
	props: record({
		attributeName: smilTarget,
		from: smilValue,
		to: smilValue,
		dur: fc.constantFrom("1s", undefined),
		class: fc.constantFrom("a", undefined),
		style: fc.constantFrom("fill:red", undefined),
		by: smilValue,
		values: smilValue,
	}),
	read: () => undefined,
});

const kinds: Kind[] = [
	smil("animate"),
	smil("set"),
	smil("animateMotion"),
	{
		name: "div",
		view: (props) => jsx("div", props),
		props: record({
			id: fc.constantFrom("m", "n", undefined, null),
			title: fc.constantFrom("m", "n", undefined, null),
			class: fc.constantFrom("a", "b c", undefined, null, false),
			"data-x": fc.constantFrom("m", undefined, null),
			"aria-label": fc.constantFrom("m", undefined, null),
			hidden: fc.constantFrom(true, false, undefined, null),
			draggable: fc.constantFrom(true, false, undefined),
			spellcheck: fc.constantFrom(true, false, undefined),
			style: fc.constantFrom("color: red", { color: "blue" }, undefined),
			tabIndex: fc.constantFrom(0, 1, undefined),
			translate: fc.constantFrom(true, false, undefined),
			contentEditable: fc.constantFrom(
				true,
				false,
				"plaintext-only",
				undefined,
			),
			lang: fc.constantFrom("en", undefined, null),
			onClick: fc.constantFrom(() => {}, undefined),
		}),
		read: () => undefined,
	},
	{
		// value and checked are controlled: dropping them leaves the live state
		// by contract, so every render passes them.
		name: "input",
		view: (props) => jsx("input", props),
		props: record(
			{
				value: fc.constantFrom("a", "b", ""),
				checked: fc.boolean(),
				disabled: fc.constantFrom(true, false, undefined),
				title: fc.constantFrom("m", undefined),
				id: fc.constantFrom("m", undefined),
				type: fc.constantFrom("text", undefined),
				placeholder: fc.constantFrom("p", undefined, null),
				maxLength: fc.constantFrom(3, undefined),
			},
			["value", "checked"],
		),
		read: (el) => ({
			value: (el as HTMLInputElement).value,
			checked: (el as HTMLInputElement).checked,
			disabled: (el as HTMLInputElement).disabled,
		}),
	},
	{
		name: "x-converge",
		view: (props) => jsx("x-converge", props),
		props: record({
			active: fc.constantFrom(true, false, undefined),
			count: fc.constantFrom(0, 1, 2, undefined),
			id: fc.constantFrom("m", undefined),
			title: fc.constantFrom("m", undefined),
		}),
		read: (el) => ({
			active: (el as ConvergeElement).active,
			count: (el as ConvergeElement).count,
		}),
	},
];

function snapshot(host: Element, kind: Kind): unknown {
	const element = host.querySelector(
		kind.name === "animateMotion" ? "animateMotion" : kind.name,
	);
	if (!element) return null;
	return {
		attributes: Array.from(element.attributes)
			.map((attribute) => `${attribute.name}=${attribute.value}`)
			.sort(),
		properties: kind.read(element),
	};
}

function strip(value: string | null): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: mirrors the guard
	return (value ?? "").replace(/[\u0000-\u0020]/g, "").toLowerCase();
}

function isExecutable(value: string | null): boolean {
	return strip(value)
		.split(";")
		.some((part) => /^(javascript|vbscript):/.test(part));
}

function assertSafe(host: Element, kind: Kind): void {
	const element = host.querySelector(kind.name);
	if (!element || !/^(animate|set|animatemotion)$/i.test(kind.name)) return;
	const name = element.getAttribute("attributeName");
	const hrefTarget =
		name !== null && strip(name).split(/[:}]/).pop() === "href";
	if (!hrefTarget) return;
	for (const key of ["from", "to", "by", "values"]) {
		expect(isExecutable(element.getAttribute(key))).toBe(false);
	}
}

function fresh(kind: Kind, props: Props): Element {
	const host = document.createElement("div");
	mountIgniteJsx(host, kind.view(props));
	return host;
}

describe("render convergence", () => {
	// Known divergence, a different root cause (patchStyle object diff): a key
	// that stays present with a null/undefined value is not removed, so
	// {style:{color:"blue"}} then {style:{color:undefined}} keeps blue.
	// Known divergence, native getter-equality (kept: the browser model expects
	// no attribute for a default): {lang:"en"} then {lang:""} writes lang="",
	// a fresh {lang:""} writes nothing.
	it.todo("native reflected default string commits like an update");
	it.todo("style object key that becomes undefined is removed");

	for (const kind of kinds) {
		it(`${kind.name}: incremental renders equal a fresh render of the final props and stay safe`, () => {
			fc.assert(
				fc.property(
					fc.array(kind.props, { minLength: 1, maxLength: 6 }),
					(sequence) => {
						const host = document.createElement("div");
						let tree = mountIgniteJsx(host, kind.view(sequence[0] ?? {}));
						assertSafe(host, kind);
						for (const props of sequence.slice(1)) {
							tree = renderIgniteJsx(host, kind.view(props), tree);
							assertSafe(host, kind);
						}
						const last = sequence[sequence.length - 1] ?? {};
						expect(snapshot(host, kind)).toEqual(
							snapshot(fresh(kind, last), kind),
						);
					},
				),
				{ seed, numRuns },
			);
		});

		it(`${kind.name}: first mount equals an update from empty props`, () => {
			fc.assert(
				fc.property(kind.props, (props) => {
					const host = document.createElement("div");
					const tree = mountIgniteJsx(host, kind.view({}));
					renderIgniteJsx(host, kind.view(props), tree);
					expect(snapshot(host, kind)).toEqual(
						snapshot(fresh(kind, props), kind),
					);
				}),
				{ seed, numRuns },
			);
		});
	}

	it("a blocked SMIL value is written once its target stops blocking it", () => {
		const host = document.createElement("div");
		const view = (props: Props) =>
			jsx("svg", { children: jsx("animate", props) });
		const tree = mountIgniteJsx(
			host,
			view({ attributeName: "href", to: "10" }),
		);
		expect(host.querySelector("animate")?.hasAttribute("to")).toBe(false);
		renderIgniteJsx(host, view({ attributeName: "width", to: "10" }), tree);
		expect(host.querySelector("animate")?.getAttribute("to")).toBe("10");
	});

	it("every present explicit false reaches an own custom setter, first mount or update", () => {
		fc.assert(
			fc.property(
				fc.array(kinds[5].props, { maxLength: 4 }),
				fc.boolean(),
				(history, mountFirst) => {
					const host = document.createElement("div");
					const final = { active: false };
					let tree = mountIgniteJsx(
						host,
						jsx("x-converge", mountFirst ? final : (history[0] ?? {})),
					);
					for (const props of mountFirst ? history : history.slice(1)) {
						tree = renderIgniteJsx(host, jsx("x-converge", props), tree);
					}
					tree = renderIgniteJsx(host, jsx("x-converge", final), tree);
					const el = host.querySelector("x-converge");
					expect(el?.getAttribute("data-active-set")).toBe("false");
				},
			),
			{ seed, numRuns },
		);
	});

	it("a present explicit false reaches an own custom setter on first mount", () => {
		const host = document.createElement("div");
		mountIgniteJsx(host, jsx("x-converge", { active: false }));
		const el = host.querySelector("x-converge") as ConvergeElement;
		expect(el.getAttribute("data-active-set")).toBe("false");
	});
});
