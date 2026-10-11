// @vitest-environment node
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "@playwright/test";
import * as fc from "fast-check";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
	AliasReport,
	AliasScenario,
	OptionSpec,
	ResetReport,
	ResetScenario,
	SinkScenario,
	TagSpec,
	ValueSpec,
} from "./scenarios";

// Fixed seed so CI replays the same cases. Override locally to explore.
const SEED = Number(process.env.FAST_CHECK_SEED ?? 168171);
const NUM_RUNS = Number(process.env.FAST_CHECK_NUM_RUNS ?? 40);

const token = fc.string({
	unit: fc.constantFrom(..."abcd1234"),
	minLength: 1,
	maxLength: 4,
});

const tagArb: fc.Arbitrary<TagSpec> = fc.oneof(
	fc
		.constantFrom(
			"text",
			"search",
			"email",
			"password",
			"url",
			"number",
			"checkbox",
			"radio",
		)
		.map((type) => ({ kind: "input" as const, type })),
	fc.constant({ kind: "textarea" as const }),
	fc.boolean().map((multiple) => ({ kind: "select" as const, multiple })),
	fc.constant({ kind: "div" as const }),
	fc.constant({ kind: "custom" as const }),
	fc.constant({ kind: "audio" as const }),
	fc.constant({ kind: "label" as const }),
	fc.constant({ kind: "form" as const }),
);

function propKeys(tag: TagSpec): string[] {
	const common = [
		"id",
		"title",
		"hidden",
		"tabIndex",
		"className",
		"lang",
		"spellcheck",
	];
	if (tag.kind === "input") {
		const box = tag.type === "checkbox" || tag.type === "radio";
		return box
			? [...common, "checked", "defaultChecked", "value", "name", "disabled"]
			: [
					...common,
					"value",
					"defaultValue",
					"placeholder",
					"name",
					"readOnly",
					"disabled",
				];
	}
	if (tag.kind === "textarea") {
		return [
			...common,
			"value",
			"defaultValue",
			"placeholder",
			"readOnly",
			"rows",
		];
	}
	if (tag.kind === "select") {
		return [...common, "value", "disabled", "name", "length", "textContent"];
	}
	if (tag.kind === "custom") {
		return [
			"label",
			"count",
			"id",
			"title",
			"hidden",
			"scrollTop",
			"textContent",
			"defaultValue",
			"defaultChecked",
			"defaultSelected",
		];
	}
	if (tag.kind === "label") {
		return [...common, "htmlFor", "HtmlFor", "HTMLFOR"];
	}
	if (tag.kind === "form") {
		return [...common, "acceptCharset", "AcceptCharset", "acceptcharset"];
	}
	if (tag.kind === "audio") {
		return [...common, "volume", "playbackRate", "currentTime"];
	}
	return [
		...common,
		"class",
		"scrollTop",
		"scrollLeft",
		"innerHTML",
		"textContent",
	];
}

function propValue(
	tag: TagSpec,
	key: string,
): fc.Arbitrary<string | number | boolean> {
	if (
		key === "checked" ||
		key === "defaultChecked" ||
		key === "defaultSelected" ||
		key === "hidden" ||
		key === "disabled" ||
		key === "readOnly" ||
		key === "spellcheck"
	) {
		return fc.boolean();
	}
	if (
		key === "tabIndex" ||
		key === "scrollTop" ||
		key === "scrollLeft" ||
		key === "rows" ||
		key === "length" ||
		key === "count"
	) {
		return fc.integer({ min: 0, max: 4 });
	}
	if (key === "innerHTML" || key === "textContent") {
		return fc.constantFrom("plain", "<p>x</p>");
	}
	if (key === "value" && tag.kind === "input" && tag.type === "number") {
		return fc.integer({ min: 0, max: 20 }).map(String);
	}
	if (key === "value" && tag.kind === "select") {
		return fc.constantFrom("a", "b", "c", "missing");
	}
	if (key === "volume") return fc.constantFrom(0, 0.25, 0.5, 1);
	if (key === "playbackRate") return fc.constantFrom(0, 0.5, 1, 2);
	if (key === "currentTime") return fc.constantFrom(0, 1, 4);
	return token;
}

const optionArb: fc.Arbitrary<OptionSpec> = fc.record({
	value: fc.constantFrom("a", "b", "c", "d"),
	text: token,
	defaultSelected: fc.boolean(),
	selected: fc.option(fc.boolean(), { nil: null }),
});

const resetArb: fc.Arbitrary<ResetScenario> = tagArb.chain((tag) => {
	const keys = propKeys(tag);
	return fc.subarray(keys).chain((chosen) => {
		let entries: fc.Arbitrary<[string, string | number | boolean][]> =
			fc.constant([]);
		for (const key of chosen) {
			entries = entries.chain((list) =>
				propValue(tag, key).map((value) => [...list, [key, value] as const]),
			);
		}
		const optionsArb =
			tag.kind === "select"
				? fc.uniqueArray(optionArb, {
						minLength: 0,
						maxLength: 3,
						selector: (option) => option.value,
					})
				: fc.constant<OptionSpec[]>([]);
		return entries.chain((pairs) =>
			optionsArb.chain((options) => {
				const droppable = [...chosen];
				if (options.some((option) => option.selected != null)) {
					droppable.push("selected");
				}
				if (options.some((option) => option.defaultSelected)) {
					droppable.push("defaultSelected");
				}
				const falseable: string[] = [];
				for (const [key, value] of pairs) {
					if (
						(key === "defaultChecked" || key === "defaultSelected") &&
						value === true
					) {
						falseable.push(key);
					}
				}
				if (options.some((option) => option.defaultSelected)) {
					falseable.push("defaultSelected");
				}
				return fc.subarray(falseable).chain((falses) =>
					fc
						.subarray(droppable.filter((key) => !falses.includes(key)))
						.map((drop) => ({
							tag,
							props: Object.fromEntries(pairs),
							drop,
							falses,
							options: tag.kind === "select" ? options : [],
						})),
				);
			}),
		);
	});
});

const customDefaultArb: fc.Arbitrary<ResetScenario> = fc
	.constantFrom("defaultValue", "defaultChecked", "defaultSelected")
	.chain((key) =>
		(key === "defaultValue" ? token : fc.constant(true)).map((value) => ({
			tag: { kind: "custom" as const },
			props: { [key]: value },
			drop: [key],
			falses: [],
			options: [],
		})),
	);

const explicitFalseArb: fc.Arbitrary<ResetScenario> = fc.oneof(
	fc.constantFrom("checkbox", "radio").chain((type) =>
		fc
			.record({
				defaultValue: fc.option(token, { nil: null }),
				dropDefault: fc.boolean(),
				checked: fc.option(fc.boolean(), { nil: null }),
			})
			.map(({ defaultValue, dropDefault, checked }) => {
				const props: Record<string, string | boolean> = {
					defaultChecked: true,
				};
				const drop: string[] = [];
				if (defaultValue != null) {
					props.defaultValue = defaultValue;
					if (dropDefault) drop.push("defaultValue");
				}
				if (checked != null) props.checked = checked;
				return {
					tag: { kind: "input" as const, type },
					props,
					drop,
					falses: ["defaultChecked"],
					options: [],
				};
			}),
	),
	fc
		.record({
			value: fc.constantFrom("a", "b", "c"),
			text: token,
			selected: fc.option(fc.boolean(), { nil: null }),
		})
		.map(({ value, text, selected }) => ({
			tag: { kind: "select" as const, multiple: false },
			props: {},
			drop: [],
			falses: ["defaultSelected"],
			options: [
				{
					value,
					text,
					defaultSelected: true,
					selected,
				},
			],
		})),
);

const reflectedNameArb: fc.Arbitrary<ResetScenario> = fc.oneof(
	fc
		.record({
			key: fc.constantFrom("htmlFor", "HtmlFor", "HTMLFOR"),
			value: token,
		})
		.map(({ key, value }) => ({
			tag: { kind: "label" as const },
			props: { [key]: value },
			drop: [key],
			falses: [],
			options: [],
		})),
	fc
		.record({
			key: fc.constantFrom("acceptCharset", "AcceptCharset", "acceptcharset"),
			value: token,
		})
		.map(({ key, value }) => ({
			tag: { kind: "form" as const },
			props: { [key]: value },
			drop: [key],
			falses: [],
			options: [],
		})),
);

const aliasArb: fc.Arbitrary<AliasScenario> = fc.oneof(
	fc
		.record({
			pair: fc.constantFrom(
				["data-id", "DATA-ID"],
				["DATA-ID", "data-id"],
				["data-id", "Data-Id"],
				["id", "ID"],
				["ID", "id"],
				["title", "TITLE"],
				["TITLE", "title"],
				["lang", "LANG"],
			),
			value: token,
			next: token,
			tag: fc.constantFrom("div", "span", "button"),
		})
		.map(({ pair, value, next, tag }) => ({
			kind: "attr" as const,
			tag,
			fromKey: pair[0],
			toKey: pair[1],
			value,
			next,
		})),
	fc
		.record({
			pair: fc.constantFrom(
				["onClick", "onclick"],
				["onclick", "onClick"],
				["onClick", "ONCLICK"],
				["ONCLICK", "onClick"],
				["onChange", "onchange"],
				["onchange", "onChange"],
			),
			same: fc.boolean(),
			value: token,
			tag: fc.constantFrom("div", "button", "span"),
		})
		.map(({ pair, same, value, tag }) => ({
			kind: "event" as const,
			tag,
			fromKey: pair[0],
			toKey: pair[1],
			value,
			next: same ? value : `${value}x`,
		})),
);

const noise = fc.string({
	unit: fc.constantFrom(
		" ",
		"\t",
		"\n",
		"\r",
		String.fromCharCode(0),
		String.fromCharCode(127),
	),
	maxLength: 2,
});

const decorated = fc
	.record({
		base: fc.constantFrom(
			"javascript:alert(1)",
			"JAVASCRIPT:alert(1)",
			"vbscript:msg",
			"data:text/html,<script>alert(1)</script>",
			"data:image/svg+xml,<svg></svg>",
			"data:application/xhtml+xml,<html></html>",
			"https://example.com/ok",
			"/safe.txt",
		),
		prefix: noise,
		suffix: noise,
		entity: fc.constantFrom("none" as const, "js" as const, "colon" as const),
	})
	.map(({ base, prefix, suffix, entity }) => {
		let text: string = base;
		if (entity === "js") text = text.replace(/javascript/i, "java&#115;cript");
		if (entity === "colon") text = text.replace(":", "&#58;");
		return `${prefix}${text}${suffix}`;
	});

const valueSpec: fc.Arbitrary<ValueSpec> = decorated.chain((value) =>
	fc.constantFrom<ValueSpec>(
		{ kind: "string", value },
		{ kind: "array", values: [value] },
		{ kind: "boxed", value },
		{ kind: "toString", value },
		{ kind: "primitive", value },
	),
);

const attributeName: fc.Arbitrary<ValueSpec> = fc
	.constantFrom(
		"href",
		"HREF",
		"xlink:href",
		"href ",
		`href${String.fromCharCode(0)}`,
		"width",
	)
	.chain((value) =>
		fc.constantFrom<ValueSpec>(
			{ kind: "string", value },
			{ kind: "array", values: [value] },
			{ kind: "toString", value },
		),
	);

const sinkArb: fc.Arbitrary<SinkScenario> = fc.record({
	surface: fc.constantFrom(
		"href" as const,
		"src" as const,
		"action" as const,
		"formaction" as const,
		"srcdoc" as const,
		"handler" as const,
		"animate" as const,
		"set" as const,
		"meta" as const,
	),
	value: valueSpec,
	next: valueSpec,
	handlerName: fc.constantFrom(
		"onClick",
		"onclick",
		"ONCLICK",
		"onerror",
		"onfocus",
		"onload",
	),
	attributeName,
	metaKey: fc.constantFrom(
		"httpEquiv",
		"http-equiv",
		"HTTP-EQUIV",
		"http-equiv ",
		`http-equiv${String.fromCharCode(0)}`,
	),
});

function explainReset(
	scenario: ResetScenario,
	report: ResetReport,
): string | null {
	const problems: string[] = [];
	const childCount =
		scenario.tag.kind === "select" ? scenario.options.length : 1;
	if (report.mounts !== childCount) {
		problems.push(`mounts ${report.mounts} wanted ${childCount}`);
	}
	if (report.unmounts !== 0) problems.push(`unmounts ${report.unmounts}`);
	if (report.optionCountBefore !== report.optionCountAfter) {
		problems.push(
			`options ${report.optionCountBefore} -> ${report.optionCountAfter}`,
		);
	}
	if (!report.sameOptionNodes) problems.push("option nodes replaced");
	if (JSON.stringify(report.updated) !== JSON.stringify(report.fresh)) {
		problems.push(
			`allowlist ${JSON.stringify(report.updated)} fresh ${JSON.stringify(report.fresh)}`,
		);
	}
	for (const reading of report.offList) {
		if (reading.before !== reading.after) {
			problems.push(`${reading.key} ${reading.before} -> ${reading.after}`);
		}
		if (reading.attrBefore !== reading.attrAfter) {
			problems.push(
				`${reading.key} attr ${reading.attrBefore} -> ${reading.attrAfter}`,
			);
		}
	}
	return problems.length === 0 ? null : problems.join("; ");
}

function explainAlias(
	scenario: AliasScenario,
	report: AliasReport,
): string | null {
	if (scenario.kind === "attr") {
		const updated = JSON.stringify(report.updatedAttrs);
		const fresh = JSON.stringify(report.freshAttrs);
		return updated === fresh
			? null
			: `alias attrs ${updated} fresh ${fresh}`;
	}
	const same = scenario.value === scenario.next;
	const wantFirst = same ? 1 : 0;
	const wantSecond = same ? 0 : 1;
	if (report.firstCalls === wantFirst && report.secondCalls === wantSecond) {
		return null;
	}
	return `listeners ${report.firstCalls},${report.secondCalls} wanted ${wantFirst},${wantSecond}`;
}

async function bundleHarness(): Promise<string> {
	const entry = fileURLToPath(new URL("./harness.ts", import.meta.url));
	const result = await build({
		configFile: false,
		logLevel: "silent",
		define: {
			__IGNITE_DEV_WARNINGS__: "false",
			__IGNITE_HOST_RUNTIME__: "true",
		},
		build: {
			write: false,
			minify: false,
			lib: {
				entry,
				formats: ["iife"],
				name: "IgnitePropertyHarness",
				fileName: () => "harness.js",
			},
		},
	});
	const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
		"output" in item ? item.output : [],
	);
	const chunk = outputs.find((output) => output.type === "chunk");
	if (!chunk || chunk.type !== "chunk") {
		throw new Error("property harness bundle produced no JavaScript");
	}
	return chunk.code;
}

describe("renderer properties in Chromium", () => {
	let browser: Browser;
	let page: Page;

	beforeAll(async () => {
		const code = await bundleHarness();
		browser = await chromium.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-dev-shm-usage"],
		});
		page = await browser.newPage();
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.addScriptTag({ content: code });
		await page.waitForFunction(() => "__igniteProperties" in window);
	}, 60_000);

	afterAll(async () => {
		await browser?.close();
	});

	async function resetOf(scenario: ResetScenario): Promise<ResetReport> {
		return page.evaluate((input) => {
			const properties = (
				window as unknown as {
					__igniteProperties: {
						runReset: (value: typeof input) => ResetReport;
					};
				}
			).__igniteProperties;
			return properties.runReset(input);
		}, scenario);
	}

	async function assertReset(arb: fc.Arbitrary<ResetScenario>) {
		await fc.assert(
			fc.asyncProperty(arb, async (scenario) => {
				const problem = explainReset(scenario, await resetOf(scenario));
				if (problem) {
					throw new Error(`${problem}\n${JSON.stringify(scenario)}`);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	}

	it("allowlisted drops match a fresh mount and other props stay", async () => {
		expect(SEED).toBeGreaterThan(0);
		await assertReset(resetArb);
	}, 120_000);

	it("keeps a renamed attribute or listener on the same normalized key", async () => {
		await fc.assert(
			fc.asyncProperty(aliasArb, async (scenario) => {
				const report = await page.evaluate((input) => {
					const properties = (
						window as unknown as {
							__igniteProperties: {
								runAlias: (value: typeof input) => AliasReport;
							};
						}
					).__igniteProperties;
					return properties.runAlias(input);
				}, scenario);
				const problem = explainAlias(scenario, report);
				if (problem) {
					throw new Error(`${problem}\n${JSON.stringify(scenario)}`);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	}, 120_000);

	it("assigns undefined when a custom default setter is dropped", async () => {
		await assertReset(customDefaultArb);
	}, 120_000);

	it("clears an explicit false defaultChecked or defaultSelected", async () => {
		await assertReset(explicitFalseArb);
	}, 120_000);

	it("removes for and accept-charset when htmlFor or acceptCharset is dropped", async () => {
		await assertReset(reflectedNameArb);
	}, 120_000);

	it("never lets an executable URL or handler reach the DOM", async () => {
		await fc.assert(
			fc.asyncProperty(sinkArb, async (scenario) => {
				const report = await page.evaluate((input) => {
					const properties = (
						window as unknown as {
							__igniteProperties: {
								runSink: (value: typeof input) => { armed: string[] };
							};
						}
					).__igniteProperties;
					return properties.runSink(input);
				}, scenario);
				if (report.armed.length > 0) {
					throw new Error(
						`${report.armed.join("; ")}\n${JSON.stringify(scenario)}`,
					);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	}, 120_000);
});
