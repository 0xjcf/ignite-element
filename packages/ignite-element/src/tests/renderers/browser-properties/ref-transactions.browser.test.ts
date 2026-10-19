// @vitest-environment node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import * as fc from "fast-check";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SelectCase, TransactionCase } from "./ref-transactions";
const seed = Number(process.env.FAST_CHECK_SEED ?? 168173);
const numRuns = Number(process.env.FAST_CHECK_NUM_RUNS ?? 60);
const kinds: TransactionCase["kind"][] = [
	"setter",
	"connect",
	"abandon",
	"nested-failure",
	"retire",
	"rebind",
	"self-retire",
	"stable-nested",
	"native-radio",
];
describe("public renderer ref transactions", () => {
	let browser: Browser;
	let page: Page;
	beforeAll(async () => {
		const root = fileURLToPath(new URL("../../../../../..", import.meta.url));
		const result = await build({
			configFile: false,
			logLevel: "silent",
			define: {
				__IGNITE_DEV_WARNINGS__: "false",
				__IGNITE_HOST_RUNTIME__: "false",
			},
			resolve: {
				alias: {
					"@ignite-element/renderer/jsx": path.join(
						root,
						process.env.RENDERER_PUBLISHED
							? "packages/ignite-renderer/dist/jsx.es.js"
							: "packages/ignite-renderer/src/renderers/ignite-jsx.ts",
					),
				},
			},
			build: {
				write: false,
				minify: false,
				lib: {
					entry: fileURLToPath(
						new URL("./ref-transactions.ts", import.meta.url),
					),
					formats: ["iife"],
					name: "RefTransactions",
				},
			},
		});
		const chunk = (Array.isArray(result) ? result : [result])
			.flatMap((item) => ("output" in item ? item.output : []))
			.find((output) => output.type === "chunk");
		if (!chunk || chunk.type !== "chunk")
			throw new Error("missing transaction harness");
		browser = await chromium.launch({ headless: true, chromiumSandbox: true });
		page = await browser.newPage();
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.addScriptTag({ content: chunk.code });
	}, 60000);
	afterAll(async () => {
		await browser?.close();
	});
	it.each(kinds)(
		"owns pending callbacks across %s",
		async (kind) => {
			const arbitrary = fc.record({
				value: fc.string({
					unit: fc.constantFrom(..."abc123"),
					minLength: 1,
					maxLength: 5,
				}),
				connected: fc.boolean(),
			});
			await fc.assert(
				fc.asyncProperty(arbitrary, async (sample) => {
					const scenario = { ...sample, kind };
					const report = await page.evaluate(
						(input) => window.__refTransactions(input),
						scenario,
					);
					expect(report.afterUnrelated).toBe(report.beforeUnrelated);
					expect(report.beforeUnrelated).toBe(0);
					if (kind === "native-radio") {
						expect(report.native).toEqual({
							value: sample.value,
							defaultValue: sample.value,
							valueAttribute: sample.value,
							checked: false,
							defaultChecked: true,
							checkedAttribute: "",
						});
					} else if (
						kind === "setter" ||
						kind === "connect" ||
						kind === "nested-failure"
					) {
						expect(report.seen).toHaveLength(1);
						expect(report.seen[0]).toEqual({
							value: sample.value,
							placed: true,
							connected: sample.connected || kind === "connect",
							children: report.finalChildren,
						});
						if (kind !== "nested-failure")
							expect(report.inner).toEqual([{ value: "inner", placed: true }]);
					} else if (kind === "retire" || kind === "rebind") {
						expect(report.seen).toHaveLength(0);
						if (kind === "rebind")
							expect(report.inner).toEqual([
								{ value: "rebound", placed: true },
							]);
					} else if (kind === "self-retire" || kind === "stable-nested")
						expect(report.cleanup).toBe(1);
					if (kind === "stable-nested")
						expect(report.cleanupBeforeDetach).toBe(0);
				}),
				{ seed, numRuns },
			);
		},
		120000,
	);
	it.each(["option", "live", "insert"] as const)(
		"applies native select setters through %s",
		async (mode) => {
			const arbitrary = fc.record({
				value: fc.string({
					unit: fc.constantFrom(..."abc123"),
					minLength: 1,
					maxLength: 5,
				}),
				multiple: fc.boolean(),
				connected: fc.boolean(),
			});
			await fc.assert(
				fc.asyncProperty(arbitrary, async (sample) => {
					const scenario: SelectCase = { ...sample, mode };
					const report = await page.evaluate(
						(input) => window.__selectTransaction(input),
						scenario,
					);
					expect(report.actual).toEqual(report.expected);
					expect(report.observations).toHaveLength(report.expected.length);
					report.observations.forEach((observation, index) => {
						expect(observation.state).toEqual(report.expected[index]);
						expect(observation.placed).toBe(true);
						expect(observation.connected).toBe(sample.connected);
					});
				}),
				{ seed: Number(process.env.FAST_CHECK_SEED ?? 168174), numRuns },
			);
		},
		120000,
	);
});
