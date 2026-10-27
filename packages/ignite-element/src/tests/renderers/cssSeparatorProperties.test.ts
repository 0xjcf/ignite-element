import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { igniteAuthorStyle } from "../../../../ignite-renderer/src/renderers/jsx/authorStyle";
import {
	cssTextWithoutUrls,
	styleSheetFromChildren,
	unmarkedStyleDroppedRemote,
} from "../../../../ignite-renderer/src/renderers/jsx/xssGuard";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx } from "../../renderers/jsx/renderer";

afterEach(() => document.body.replaceChildren());

const tokenBlock = fc.constantFrom(
	"{}",
	"{{}}",
	"{color:red;size:2px}",
	"{;nested:{a:b;c:d};}",
	'{label:"};{";/* ;{} */nested:{}}',
);

describe("CSS declaration separators", () => {
	it("preserves the reported custom-property separator", () => {
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: ".x{--theme:{};color:red}", author: true },
			]),
		).toEqual({ css: ".x{--theme:{};color:red}", droppedUrl: false });
	});

	it("preserves generated token blocks, declarations and adjacent rules", () => {
		fc.assert(
			fc.property(
				tokenBlock,
				fc.boolean(),
				fc.constantFrom("", " ", "/* boundary */"),
				fc.constantFrom(
					"",
					" \n\t",
					"/* star* still ;}{ slash/ still */ ",
					"/* before / { still */ ",
					"/*/ { still */ ",
				),
				fc.nat(),
				(block, author, gap, prefix, split) => {
					const css = `.x{${prefix}--theme:${block};${gap}color:red;--next:${block};width:7px}.y{color:blue}`;
					const at = split % (css.length + 1);
					expect(
						styleSheetFromChildren([
							{ kind: "text", value: css.slice(0, at), author },
							{ kind: "text", value: css.slice(at), author },
						]),
					).toEqual({ css, droppedUrl: false });
				},
			),
			{ seed: 1806, numRuns: 80 },
		);
	});

	it("keeps separators when a neighboring loader declaration is removed", () => {
		fc.assert(
			fc.property(
				tokenBlock,
				fc.constantFrom(
					"background:url(https://evil.example/x)",
					"background:u\\rl(https://evil.example/x)",
					"background:image-set('https://evil.example/x' 1x)",
					"width:expression(1)",
				),
				(block, loader) => {
					for (const value of [
						`.x{${loader};--theme:${block};color:red}.y{color:blue}`,
						`.x{--theme:${block};${loader};color:red}.y{color:blue}`,
						`.x{--theme:${block};color:red;${loader}}.y{color:blue}`,
					]) {
						const result = styleSheetFromChildren([{ kind: "text", value }]);
						expect(result).toEqual({
							css: `.x{--theme:${block};color:red}.y{color:blue}`,
							droppedUrl: true,
						});
					}
				},
			),
			{ seed: 1806, numRuns: 40 },
		);
	});

	it("keeps custom-property token blocks in declaration lists", () => {
		fc.assert(
			fc.property(tokenBlock, (block) => {
				const declarations = `color:red;--theme:${block};width:7px`;
				expect(cssTextWithoutUrls(declarations)).toBe(declarations);
			}),
			{ seed: 1806, numRuns: 20 },
		);
	});

	it("distinguishes custom-element selectors and nested rules from value blocks", () => {
		for (const css of [
			"--widget:hover{background:url(//evil)}.y{color:blue}",
			"@media all{.x{background:url(//evil)}}.y{color:blue}",
			".x{.nested{background:url(//evil)}color:red}.y{color:blue}",
			".x{.child--x:hover{background:url(//evil)}color:red}.y{color:blue}",
			"a *{background:url(//evil)}.y{color:blue}",
		]) {
			const result = styleSheetFromChildren([{ kind: "text", value: css }]);
			expect(result.droppedUrl).toBe(true);
			expect(result.css).not.toContain("url");
			expect(result.css).toContain(".y{color:blue}");
			expect(result.css).not.toContain("};");
			if (css.startsWith(".x{")) expect(result.css).toContain("color:red");
		}
	});

	it("preserves escaped author strings and comments in custom-property names", () => {
		for (const css of [
			'.x{--theme:{label:"quoted\\"};{";nested:{}};color:red}',
			".x{--theme/* :;{} */ :{};color:red}",
		]) {
			expect(
				styleSheetFromChildren([{ kind: "text", value: css, author: true }]),
			).toEqual({ css, droppedUrl: false });
		}
	});

	it("keeps remote-load diagnostics consistent with the checked sheet", () => {
		const remote = ".x{--theme:{};background:url(//evil)}";
		expect(unmarkedStyleDroppedRemote([{ kind: "text", value: remote }])).toBe(
			true,
		);
		expect(
			unmarkedStyleDroppedRemote([
				{ kind: "text", value: remote, author: true },
			]),
		).toBe(false);
		expect(
			unmarkedStyleDroppedRemote([
				{ kind: "comment", value: remote },
				{ kind: "text" },
				{ kind: "text", value: ".x{--theme:{};color:red}" },
			]),
		).toBe(false);
		expect(
			unmarkedStyleDroppedRemote([
				{ kind: "text", value: ".x{width:expression(1)}" },
			]),
		).toBe(false);
		expect(
			unmarkedStyleDroppedRemote([
				{ kind: "text", value: "</style>url(//evil)" },
			]),
		).toBe(true);
		expect(
			unmarkedStyleDroppedRemote([
				{ kind: "text", value: "</style>.x{color:red}" },
			]),
		).toBe(false);
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: "</style>.x{color:red}", author: true },
			]),
		).toEqual({ css: "", droppedUrl: true });
	});

	it("drops a blocked custom-property block whole and preserves following declarations", () => {
		for (const author of [false, true]) {
			const result = styleSheetFromChildren([
				{
					kind: "text",
					value:
						".x{--theme:{nested:{width:expression(1)}};color:red}.y{color:blue}",
					author,
				},
			]);
			expect(result).toEqual({
				css: ".x{color:red}.y{color:blue}",
				droppedUrl: true,
			});
		}
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: ".x{--theme:{image:url(//evil)};color:red}" },
			]),
		).toEqual({ css: ".x{color:red}", droppedUrl: true });
	});

	it("delivers the same CSS through marked style children and style attributes", () => {
		const root = document.createElement("div");
		document.body.append(root);
		const declarations = "--theme:{};color:red";
		const css = `.x{${declarations}}.y{color:blue}`;
		mountIgniteJsx(
			root,
			jsx("div", {
				style: declarations,
				children: jsx("style", { children: igniteAuthorStyle(css) }),
			}),
		);
		expect(root.querySelector("style")?.textContent).toBe(css);
		expect(root.querySelector("div")?.style.color).toBe("red");
	});
});
