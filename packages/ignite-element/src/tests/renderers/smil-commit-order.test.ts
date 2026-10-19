import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

// Reproduce a failure with FAST_CHECK_SEED=<seed printed by fast-check>.
const seed = Number(process.env.FAST_CHECK_SEED ?? 168402);
const numRuns = Number(process.env.FAST_CHECK_NUM_RUNS ?? 200);

const SMIL_TAGS = new Set(["animate", "set", "animatemotion"]);
const DEPENDENTS = ["from", "to", "by", "values"] as const;

beforeEach(() => {
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

function isExecutable(value: string | null): boolean {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: mirrors the guard
	const stripped = (value ?? "").replace(/[\u0000-\u0020]/g, "").toLowerCase();
	return stripped
		.split(";")
		.some((part) => /^(javascript|vbscript):/.test(part));
}

function targetsHref(name: string | null): boolean {
	if (name === null) return false;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: mirrors the guard
	const stripped = name.replace(/[\u0000-\u0020]/g, "").toLowerCase();
	return stripped.split(/[:}]/).pop() === "href";
}

/** Whether props name a href target. A non-string name is treated as href. */
function propsTargetHref(props: Record<string, unknown>): boolean {
	const name = props.attributeName;
	return typeof name === "string" ? targetsHref(name) : name != null;
}

/**
 * Records every DOM write to SMIL elements and the first moment a blocked
 * value is observable. A write is blocked when the effective post-commit
 * target is href and the value is executable. The DOM state is unsafe when it
 * holds an href target next to an executable dependent value.
 */
function watchCommit(finalHref: () => boolean): {
	violations: string[];
	stop(): void;
} {
	const violations: string[] = [];
	const check = (element: Element, name: string, value: string) => {
		if (!SMIL_TAGS.has(element.localName.toLowerCase())) return;
		if (
			(DEPENDENTS as readonly string[]).includes(name) &&
			finalHref() &&
			isExecutable(value)
		) {
			violations.push(`wrote ${name}=${value} for an href target`);
		}
		if (targetsHref(element.getAttribute("attributeName"))) {
			for (const key of DEPENDENTS) {
				if (isExecutable(element.getAttribute(key))) {
					violations.push(`DOM holds href target with ${key} executable`);
				}
			}
		}
	};
	const setAttribute = Element.prototype.setAttribute;
	const spyA = vi.spyOn(Element.prototype, "setAttribute");
	spyA.mockImplementation(function (
		this: Element,
		name: string,
		value: string,
	) {
		setAttribute.call(this, name, value);
		check(this, name, String(value));
	});
	const setAttributeNS = Element.prototype.setAttributeNS;
	const spyB = vi.spyOn(Element.prototype, "setAttributeNS");
	spyB.mockImplementation(function (
		this: Element,
		ns: string | null,
		name: string,
		value: string,
	) {
		setAttributeNS.call(this, ns, name, value);
		check(this, name, String(value));
	});
	return {
		violations,
		stop() {
			spyA.mockRestore();
			spyB.mockRestore();
		},
	};
}

function view(tag: string, props: Record<string, unknown>) {
	return jsx("svg", { children: jsx("a", { children: jsx(tag, props) }) });
}

describe("SMIL context props commit before dependents", () => {
	it("never writes an executable `to` when the next props drop an href attributeName", () => {
		const host = document.createElement("div");
		const first = view("animate", {
			attributeName: "href",
			to: "https://safe.example/",
		});
		const tree = mountIgniteJsx(host, first);
		const next = { to: "javascript:alert(1)" };
		const watch = watchCommit(() => propsTargetHref(next));
		renderIgniteJsx(host, view("animate", next), tree);
		watch.stop();
		expect(watch.violations).toEqual([]);
	});

	it("never exposes a stale executable `to` when attributeName switches to href", () => {
		const host = document.createElement("div");
		const tree = mountIgniteJsx(
			host,
			view("set", { attributeName: "width", to: "javascript:alert(1)" }),
		);
		const next = { attributeName: "href", to: "javascript:alert(1)" };
		const watch = watchCommit(() => propsTargetHref(next));
		renderIgniteJsx(host, view("set", next), tree);
		watch.stop();
		expect(watch.violations).toEqual([]);
		expect(host.querySelector("set")?.getAttribute("to")).toBeNull();
	});

	it("never writes a blocked value at any point of a random transition sequence", () => {
		const safeValue = fc.constantFrom("https://ok.example/", "1", "#a;#b");
		const unsafeValue = fc.constantFrom(
			"javascript:alert(1)",
			" JaVa\tScript:alert(1)",
			"#a;javascript:x",
			"vbscript:x",
		);
		const target = fc.constantFrom(
			undefined,
			"href",
			"xlink:href",
			" HREF",
			"{http://www.w3.org/1999/xlink}href",
			"width",
			"fill",
			7,
		);
		const propsArb = fc
			.record(
				{
					attributeName: target,
					from: fc.oneof(safeValue, unsafeValue),
					to: fc.oneof(safeValue, unsafeValue),
					by: fc.oneof(safeValue, unsafeValue),
					values: fc.oneof(safeValue, unsafeValue),
				},
				{ requiredKeys: [] },
			)
			// Own enumerable keys in a random order to cover key-order effects.
			.chain((record) =>
				fc
					.shuffledSubarray(Object.keys(record), {
						minLength: Object.keys(record).length,
					})
					.map((keys) =>
						Object.fromEntries(
							keys.map((key) => [
								key,
								(record as Record<string, unknown>)[key],
							]),
						),
					),
			);
		fc.assert(
			fc.property(
				fc.constantFrom("animate", "set", "animateMotion"),
				fc.array(propsArb, { minLength: 1, maxLength: 6 }),
				(tag, sequence) => {
					document.body.replaceChildren();
					const host = document.createElement("div");
					let tree = mountIgniteJsx(host, view(tag, sequence[0] ?? {}));
					for (const props of sequence.slice(1)) {
						const watch = watchCommit(() => propsTargetHref(props));
						tree = renderIgniteJsx(host, view(tag, props), tree);
						watch.stop();
						if (watch.violations.length > 0) {
							throw new Error(watch.violations.join("; "));
						}
					}
				},
			),
			{ seed, numRuns },
		);
	});

	it("blocks first mount in any key order", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(["to", "attributeName"], ["attributeName", "to"]),
				(order) => {
					const props: Record<string, unknown> = {};
					for (const key of order) {
						props[key] = key === "to" ? "javascript:x" : "href";
					}
					const watch = watchCommit(() => true);
					mountIgniteJsx(document.createElement("div"), view("set", props));
					watch.stop();
					expect(watch.violations).toEqual([]);
				},
			),
			{ seed, numRuns: 4 },
		);
	});
});
