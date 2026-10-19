// @vitest-environment node
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "@playwright/test";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Round 19 (PR #168). The published no-host renderer (host runtime off, dev
// warnings on) has no host-sync live() after prop patching, so a console.warn
// that supersedes is the last user code before the old commit publishes.
describe("no-host renderer: console.warn is a user-code touchpoint", () => {
	let browser: Browser;
	let page: Page;
	beforeAll(async () => {
		const result = await build({
			configFile: false,
			logLevel: "silent",
			define: {
				__IGNITE_DEV_WARNINGS__: "true",
				__IGNITE_HOST_RUNTIME__: "false",
			},
			build: {
				write: false,
				minify: false,
				lib: {
					entry: fileURLToPath(
						new URL("./warn-supersession.ts", import.meta.url),
					),
					formats: ["iife"],
					name: "WarnSupersession",
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
	it("a console.warn that supersedes while a control drops value stops the old commit", async () => {
		const result = await page.evaluate(() =>
			(
				window as unknown as {
					WarnSupersession: {
						warnSupersedes(): { warned: number; value: string };
					};
				}
			).WarnSupersession.warnSupersedes(),
		);
		expect(result.warned).toBeGreaterThan(0);
		expect(result.value).toBe("newer");
	});
	it("a keyed update whose final focus lookup supersedes does not publish", async () => {
		const published = await page.evaluate(() =>
			(
				window as unknown as {
					WarnSupersession: { focusSupersedes(): string[] };
				}
			).WarnSupersession.focusSupersedes(),
		);
		expect(published).toEqual(["newer"]);
	});
});
