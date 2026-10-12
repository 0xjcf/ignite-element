// @vitest-environment node
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "@playwright/test";
import * as fc from "fast-check";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
	AttributeCase,
	CompositionCase,
	RefCase,
} from "./commit-boundaries";
const seed = Number(process.env.FAST_CHECK_SEED ?? 168172);
const numRuns = Number(process.env.FAST_CHECK_NUM_RUNS ?? 200);
const value = fc.string({
	unit: fc.constantFrom(..."abc123"),
	minLength: 1,
	maxLength: 5,
});
describe("renderer commit boundaries in sandboxed Chromium", () => {
	let browser: Browser;
	let page: Page;
	beforeAll(async () => {
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
					entry: fileURLToPath(
						new URL("./commit-boundaries.ts", import.meta.url),
					),
					formats: ["iife"],
					name: "CommitBoundaries",
				},
			},
		});
		const outputs = (Array.isArray(result) ? result : [result]).flatMap(
			(item) => ("output" in item ? item.output : []),
		);
		const chunk = outputs.find((output) => output.type === "chunk");
		if (!chunk || chunk.type !== "chunk") throw new Error("missing harness");
		browser = await chromium.launch({ headless: true, chromiumSandbox: true });
		page = await browser.newPage();
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.addScriptTag({ content: chunk.code });
	}, 60000);
	afterAll(async () => {
		await browser?.close();
	});
	it("refs acquire final controlled state and reconciled children in the intended root", async () => {
		const arbitrary: fc.Arbitrary<RefCase> = fc.record({
			kind: fc.constantFrom(
				"input",
				"textarea",
				"checkbox",
				"radio",
				"select",
				"option",
			),
			mode: fc.constantFrom("mount", "update", "replace", "create"),
			connected: fc.boolean(),
			value,
		});
		await fc.assert(
			fc.asyncProperty(arbitrary, async (scenario) => {
				const report = await page.evaluate(
					(input) => window.__commitBoundaries.refs(input),
					scenario,
				);
				expect(report.observations.length).toBeGreaterThan(0);
				for (const observation of report.observations) {
					expect(observation.target).toEqual(observation.finalTarget);
					expect(observation.state).toEqual(report.final);
					expect(observation.placed).toBe(true);
					expect(observation.connected).toBe(
						scenario.connected && scenario.mode !== "create",
					);
				}
				if (scenario.kind === "select") expect(report.final[0].value).toBe("b");
				if (scenario.kind === "option")
					expect(report.final[1].selected).toBe(true);
				if (scenario.kind === "radio")
					expect(report.final.map((node) => node.checked)).toEqual([
						true,
						false,
					]);
			}),
			{ seed, numRuns },
		);
	}, 120000);
	it("explicit attributes retain native meaning and nullish or omitted values remove them", async () => {
		const arbitrary: fc.Arbitrary<AttributeCase> = fc.record({
			index: fc.integer({ min: 0, max: 11 }),
			update: fc.boolean(),
			inherited: fc.boolean(),
			removal: fc.constantFrom("omit", "null", "undefined"),
		});
		await fc.assert(
			fc.asyncProperty(arbitrary, async (scenario) => {
				const report = await page.evaluate(
					(input) => window.__commitBoundaries.attributes(input),
					scenario,
				);
				expect(report.actual).toEqual(report.expected);
				expect(report.removed).toEqual(report.absent);
			}),
			{ seed, numRuns },
		);
	}, 120000);
	it("only the active composition session suppresses the current controlled value", async () => {
		const arbitrary: fc.Arbitrary<CompositionCase> = fc.record({
			tag: fc.constantFrom("input", "textarea"),
			shadow: fc.boolean(),
			loss: fc.constantFrom(
				"end",
				"blur",
				"detach",
				"reconnect",
				"unmount",
				"reconnect-focus",
				"other-target",
			),
			value,
		});
		await fc.assert(
			fc.asyncProperty(arbitrary, async (scenario) => {
				const report = await page.evaluate(
					(input) => window.__commitBoundaries.composition(input),
					scenario,
				);
				expect(report.held).toBe("ime");
				expect(report.beforeNextRender).toBe("ime");
				expect(report.recovered).toBe(scenario.value);
				expect(report.nextHeld).toBe("next-ime");
				expect(report.nextRecovered).toBe("next-value");
			}),
			{ seed, numRuns },
		);
	}, 120000);
	it("captures the isolated validation surface", async () => {
		if (process.env.RENDERER_SCREENSHOT) {
			await page.evaluate(() => window.__commitBoundaries.preview());
			await page.screenshot({
				path: process.env.RENDERER_SCREENSHOT,
				fullPage: true,
			});
		}
	});
});
