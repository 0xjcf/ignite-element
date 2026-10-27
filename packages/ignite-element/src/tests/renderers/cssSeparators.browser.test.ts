import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "@playwright/test";
import fc from "fast-check";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { styleSheetFromChildren } from "../../../../ignite-renderer/src/renderers/jsx/xssGuard";

declare global {
	var CssSeparatorGuard: {
		styleSheetFromChildren: typeof styleSheetFromChildren;
	};
}

describe("CSS separators in Chromium", () => {
	let browser: Browser;
	let code: string;
	beforeAll(async () => {
		const result = await build({
			configFile: false,
			logLevel: "silent",
			build: {
				write: false,
				lib: {
					entry: fileURLToPath(
						new URL(
							"../../../../ignite-renderer/src/renderers/jsx/xssGuard.ts",
							import.meta.url,
						),
					),
					formats: ["iife"],
					name: "CssSeparatorGuard",
				},
			},
		});
		const outputs = (Array.isArray(result) ? result : [result]).flatMap(
			(item) => ("output" in item ? item.output : []),
		);
		const chunk = outputs.find((output) => output.type === "chunk");
		if (!chunk || chunk.type !== "chunk")
			throw new Error("missing guard bundle");
		code = chunk.code;
		browser = await chromium.launch({ headless: true, chromiumSandbox: true });
	}, 60000);
	afterAll(async () => browser?.close());

	it("matches native CSS parsing for generated safe token blocks and later rules", async () => {
		const page = await browser.newPage();
		await page.addScriptTag({ content: code });
		try {
			await fc.assert(
				fc.asyncProperty(
					fc.constantFrom(
						"{}",
						"{{}}",
						"{a:b;c:{d:e}}",
						'{label:"};{";/*{};*/x:{}}',
					),
					fc.boolean(),
					async (block, author) => {
						const css = `.x{--theme:${block};color:red;width:7px}.y{color:blue}`;
						const result = await page.evaluate(
							({ css, author }) => {
								const filtered = CssSeparatorGuard.styleSheetFromChildren([
									{ kind: "text", value: css, author },
								]);
								const parse = (text: string) => {
									const sheet = new CSSStyleSheet();
									sheet.replaceSync(text);
									return Array.from(sheet.cssRules, (rule) => rule.cssText);
								};
								document.body.innerHTML =
									'<style></style><div class="x"></div><div class="y"></div>';
								const style = document.querySelector("style");
								const x = document.querySelector(".x");
								const y = document.querySelector(".y");
								if (!style || !x || !y)
									throw new Error("missing native fixture");
								style.textContent = filtered.css;
								return {
									filtered,
									expectedRules: parse(css),
									actualRules: parse(filtered.css),
									color: getComputedStyle(x).color,
									width: getComputedStyle(x).width,
									siblingColor: getComputedStyle(y).color,
								};
							},
							{ css, author },
						);
						expect(result.filtered).toEqual({ css, droppedUrl: false });
						expect(result.actualRules).toEqual(result.expectedRules);
						expect(result.color).toBe("rgb(255, 0, 0)");
						expect(result.width).toBe("7px");
						expect(result.siblingColor).toBe("rgb(0, 0, 255)");
					},
				),
				{ seed: 1806, numRuns: 24 },
			);
		} finally {
			await page.close();
		}
	});
});
