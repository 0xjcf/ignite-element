import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { describe, expect, it } from "vitest";
import {
	markerCallee,
	markerLocalName,
	markFile,
	transformSource,
} from "./transform.js";

const AUTHOR = "ignite-jsx:author-style";

function localPattern(code: string): string {
	return markerCallee(code).replace(/\$/g, "\\$");
}

function marks(code: string): string[] {
	const found: string[] = [];
	let index = 0;
	const token = `${markerCallee(code)}(`;
	while (index < code.length) {
		const start = code.indexOf(token, index);
		if (start < 0) break;
		let depth = 1;
		let cursor = start + token.length;
		while (cursor < code.length && depth > 0) {
			const char = code[cursor];
			if (char === "(") depth += 1;
			else if (char === ")") depth -= 1;
			cursor += 1;
		}
		found.push(code.slice(start + token.length, cursor - 1));
		index = cursor;
	}
	return found;
}

describe("author style transform", () => {
	it("a mark keeps author loads", () => {
		const source = `
			import cardCss from "./card.css?raw";
			import other from "./other.css";
			import { sheet } from "./sheet";
			import * as ns from "./card.css?raw";
			const local = ".local{background:url(https://cdn.example/local.png)}";
			const plain = \`.plain{font-family:url(https://cdn.example/font.woff); content:"\\\\"}\`;
			const alias = local;
			const joined = ".a{}" + local;
			export function Card(props: { image: string; cardCss: string }) {
				const shadow = props.image;
				return (
					<div>
						<style>{".static{background:url(https://cdn.example/static.png)} @import 'https://cdn.example/a.css'; .f{background:image-set(url(https://cdn.example/font.png) 1x); content:'\\\\'}"}</style>
						<style>{local}</style>
						<style>{plain}</style>
						<style>{alias}</style>
						<style>{cardCss}</style>
						<style>{".a{color:red}"}{local}</style>
						<style>{\`url(\${props.image})\`}</style>
						<style>{props.cardCss}</style>
						<style>{shadow}</style>
						<style>{other}</style>
						<style>{sheet}</style>
						<style>{ns.cardCss}</style>
						<style>{joined}</style>
						<style>{cardCss}{props.image}</style>
					</div>
				);
			}
			export function Shadow(cardCss: string) {
				return <style>{cardCss}</style>;
			}
		`;
		const output = transformSource(source, "Card.tsx");
		expect(output).toContain(AUTHOR);
		expect(markerCallee(output)).toMatch(/^_igniteAuthor\$[0-9a-f]{8}$/);
		const wrapped = marks(output);
		expect(
			wrapped.some((call) => call.includes("cdn.example/static.png")),
		).toBe(true);
		expect(wrapped.some((call) => call.includes("@import"))).toBe(true);
		expect(wrapped.some((call) => call.includes("image-set"))).toBe(true);
		expect(wrapped.some((call) => call.includes("local"))).toBe(true);
		expect(wrapped.some((call) => call.includes("plain"))).toBe(true);
		expect(wrapped.some((call) => call.includes("alias"))).toBe(true);
		expect(wrapped.some((call) => call.includes("cardCss"))).toBe(true);
		expect(wrapped.some((call) => call.includes("\\"))).toBe(true);
		expect(output).toContain("props.image");
		const name = localPattern(output);
		expect(output).not.toMatch(
			new RegExp(`${name}\\(\\s*\`[^\`]*\\$\\{props\\.image\\}`),
		);
		expect(output).not.toMatch(
			new RegExp(`${name}\\(\\s*props\\.cardCss\\s*\\)`),
		);
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*shadow\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*other\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*sheet\\s*\\)`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*ns\\.`));
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*joined\\s*\\)`));
		expect(output).not.toContain("card.css?inline");
		const shadowFn = output.slice(output.indexOf("function Shadow"));
		expect(shadowFn).not.toContain(`${markerCallee(output)}(`);
	});

	it("Security P2: a hand-written author import cannot bless CSS", () => {
		expect(() =>
			transformSource(
				`import { igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{background:url(https://cdn.example/a.png)}";
			export const view = <style>{local}</style>;`,
				"reuse.tsx",
			),
		).toThrow(/cannot mark CSS/);

		const conflict = transformSource(
			`const igniteAuthorStyle = (css: string) => css;
			const local = ".a{background:url(https://cdn.example/a.png)}";
			export const view = <style>{local}</style>;
			export const stolen = igniteAuthorStyle(".b{background:url(http://127.0.0.1:9/x.png)}");`,
			"conflict.tsx",
		);
		expect(markerCallee(conflict)).not.toBe("igniteAuthorStyle");
		expect(marks(conflict).some((call) => call.includes("local"))).toBe(true);
		expect(conflict).toContain(
			'igniteAuthorStyle(".b{background:url(http://127.0.0.1:9/x.png)}")',
		);
		expect(conflict).not.toContain(
			`${markerCallee(conflict)}(".b{background:url(http://127.0.0.1:9/x.png)}")`,
		);
	});

	it("does not treat card.css?inline as author CSS", () => {
		const output = transformSource(
			`import cardCss from "./card.css?inline";
			export const view = <style>{cardCss}</style>;`,
			"inline.tsx",
		);
		expect(output).not.toContain("igniteAuthorStyle(");
	});

	it("places the compiler import after directives and beside other imports", () => {
		const withImports = transformSource(
			`"use client";
			import cardCss from "./card.css?raw";
			void 0;
			export const view = <style>{cardCss}</style>;`,
			"order.tsx",
		);
		const authorAt = withImports.indexOf("ignite-jsx:author-style");
		expect(authorAt).toBeGreaterThan(withImports.indexOf("use client"));
		expect(authorAt).toBeGreaterThan(withImports.indexOf("card.css?raw"));
		expect(authorAt).toBeLessThan(withImports.indexOf("void 0"));
		expect(withImports).toContain("igniteAuthorStyle");
		expect(withImports).toContain("ignite-jsx:author-style");

		const directiveOnly = transformSource(
			`"use client";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"directive.tsx",
		);
		expect(directiveOnly.indexOf("use client")).toBeLessThan(
			directiveOnly.indexOf("ignite-jsx:author-style"),
		);
	});

	it("keeps comments and the original style line", () => {
		const source = [
			"// keep-me",
			'export const view = <style>{".a{color:red}"}</style>;',
			"",
		].join("\n");
		const output = transformSource(source, "comment.tsx");
		expect(output).toContain("// keep-me");
		const styleLine = source
			.split("\n")
			.findIndex((line) => line.includes("<style>"));
		expect(output.split("\n")[styleLine]).toContain(markerCallee(output));
	});

	it("leaves a file without a style element unchanged", () => {
		const source = "export const n = 1;\n";
		expect(transformSource(source, "plain.ts")).toBe(source);
	});

	it("marks static wrappers, text, aliases, and raw query variants", () => {
		const directStyle = "<style>{`.direct{color:red}`}</style>";
		const output = transformSource(
			`			import rawInline from "./card.css?raw&inline";
			const local = ".a{color:red}";
			let live = ".b{color:blue}";
			var old = ".c{color:green}";
			export const view = (
				<div>
					<style>{(local)}</style>
					<style>{((local))}</style>
					<style>{local as string}</style>
					<style>{local satisfies string}</style>
					<style>{local!}</style>
					<style>{live}</style>
					<style>{old}</style>
					<style>{rawInline}</style>
					<style>.pre-color-red{local}</style>
					<style>{"a"}{"b"}</style>
					<style>{"a"}{local}</style>
					${directStyle}
					<ns:style>{local}</ns:style>
					<ns:STYLE>{local}</ns:STYLE>
					<style>{/* note */}{local}</style>
					<style> {local}</style>
					<div>{local}</div>
					<Foo.style>{local}</Foo.style>
					<ns:div>{local}</ns:div>
				</div>
			);`,
			"wrappers.tsx",
		);
		expect(output.match(/ignite-jsx:author-style/g)).toHaveLength(1);
		const wrapped = marks(output);
		expect(wrapped.some((call) => call.includes(".pre-color-red"))).toBe(true);
		expect(wrapped.some((call) => call === '"ab"' || call === "'ab'")).toBe(
			true,
		);
		expect(wrapped.some((call) => call.includes(".direct{color:red}"))).toBe(
			true,
		);
		expect(wrapped.some((call) => call.includes("rawInline"))).toBe(true);
		expect(wrapped.some((call) => call.includes("live"))).toBe(false);
		expect(wrapped.some((call) => call.includes("old"))).toBe(false);
		expect(wrapped.filter((call) => call.trim() === "local").length).toBe(8);
		expect(
			wrapped.some((call) => /^\s*["']\s+["']\s*\+\s*local\s*$/.test(call)),
		).toBe(true);
		const joined = wrapped.find(
			(call) => call.includes('"a"') || call.includes("'a'"),
		);
		expect(joined).toMatch(/local/);
		const name = localPattern(output);
		expect(output).not.toMatch(new RegExp(`${name}\\(\\s*\\)`));
		const div = output.slice(
			output.indexOf("<div>{"),
			output.indexOf("</div>"),
		);
		expect(div).not.toContain(`${markerCallee(output)}(`);
		expect(output).not.toMatch(new RegExp(`<Foo\\.style>\\{${name}\\(`));
		expect(output).not.toMatch(new RegExp(`<ns:div>\\{${name}\\(`));
	});

	it("does not mark dynamic, empty, cyclic, or non-author bindings", () => {
		const cases = [
			`const local = ".a{}";
			export const view = <style>   </style>;`,
			`export const view = <style>{""}{" "}</style>;`,
			`const a = b;
			const b = a;
			export const view = <style>{a}</style>;`,
			`let missing;
			export const view = <style>{missing}</style>;`,
			`export const view = <style>{noSuch}</style>;`,
			`function local() { return ".a{}"; }
			export const view = <style>{local}</style>;`,
			`const local = (value: string) => value;
			export function Card(local: string) { return <style>{local}</style>; }`,
			`import { cardCss } from "./card.css?raw";
			export const view = <style>{cardCss}</style>;`,
			`import * as ns from "./card.css?raw";
			export const view = <style>{ns}</style>;`,
			`import type cardCss from "./card.css?raw";
			export const view = <style>{cardCss}</style>;`,
			`import raw from "./card.css?rawextra";
			export const view = <style>{raw}</style>;`,
			`import raw from "./card.css?foo&raw";
			export const view = <style>{raw}</style>;`,
			`const local = ".a{}";
			const dyn = \`url(\${"x"})\`;
			export const view = <style>{dyn}</style>;`,
			`const local = ".a{}";
			export const view = <style>{\`url(\${local})\`}</style>;`,
			`const local = ".a{}";
			export const view = <style>{".a{}" + local}</style>;`,
			`const local = ".a{}";
			export const view = <style>{String(local)}</style>;`,
			`const local = ".a{}";
			export const view = <style>{local ? local : local}</style>;`,
			`const local = ".a{}";
			export const view = <style><><span /></></style>;`,
			`import { other as igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{}";
			export const view = <style>{local}</style>;`,
			`import igniteAuthorStyle from "ignite-element/jsx/author-style";
			const local = ".a{}";
			export const view = <style>{local}</style>;`,
		];
		for (const source of cases) {
			let output = "";
			try {
				output = transformSource(source, "reject.tsx");
			} catch (error) {
				expect(String(error)).toMatch(/cannot mark CSS/);
				continue;
			}
			expect(output, source).not.toContain(`${markerCallee(output)}(`);
		}
		const elsewhere = transformSource(
			`import { igniteAuthorStyle } from "elsewhere";
			const local = ".a{}";
			export const view = <style>{local}</style>;`,
			"elsewhere.tsx",
		);
		expect(marks(elsewhere)).toEqual(["local"]);
		expect(markerCallee(elsewhere)).not.toBe("igniteAuthorStyle");
	});

	it("Security P2: every hand-written author import is rejected", () => {
		const sources = [
			`import type { igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			`import { type igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			`import { other as mark } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			`import cardCss from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			`import { "igniteAuthorStyle" as mark } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			`import { readAuthorStyle } from "@ignite-element/renderer/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
		];
		for (const source of sources) {
			expect(() => transformSource(source, "hand.tsx"), source).toThrow(
				/cannot mark CSS/,
			);
		}
	});

	it("rejects import(), require(), re-exports, and a template specifier", () => {
		const blocked = [
			`export * from "ignite-element/jsx/author-style";
			export const view = <style>{".a{color:red}"}</style>;`,
			`export { igniteAuthorStyle } from "@ignite-element/renderer/jsx/author-style-mark";
			export const view = <style>{".a{color:red}"}</style>;`,
			`export const view = <style>{".a{color:red}"}</style>;
			const mod = import("ignite-element/jsx/author-style");`,
			`export const view = <style>{".a{color:red}"}</style>;
			const mod = require("@ignite-element/renderer/jsx/author-style");`,
			'export const view = <style>{".a{color:red}"}</style>;\nconst mod = import(`ignite-element/jsx/author-style`);',
		];
		for (const source of blocked) {
			expect(() => transformSource(source, "route.tsx"), source).toThrow(
				/cannot mark CSS/,
			);
		}

		const allowed = transformSource(
			`"use strict";
			export { local } from "./sheet";
			const mod = import("./sheet");
			export const view = <style>{".a{color:red}"}</style>;`,
			"allowed.tsx",
		);
		expect(allowed.startsWith('"use strict"')).toBe(true);
		expect(allowed).toContain("ignite-jsx:author-style");
		expect(allowed).not.toContain("ignite-element/jsx/author-style");
	});

	it("does not mark a binding in a scope that contains direct eval", () => {
		const output = transformSource(
			`const sheet = ".a{background:url(http://127.0.0.1:9/x.png)}";
			eval("sheet = '.stolen{}'");
			function sibling() {
				const kept = ".kept{color:red}";
				return <style>{kept}</style>;
			}
			export const view = (
				<div>
					<style>{sheet}</style>
					<style>{".literal{background:url(https://cdn.example/a.png)}"}</style>
					{sibling()}
				</div>
			);`,
			"eval.tsx",
		);
		const wrapped = marks(output);
		expect(wrapped.some((call) => call.trim() === "sheet")).toBe(false);
		expect(wrapped.some((call) => call.includes("cdn.example/a.png"))).toBe(
			true,
		);
		expect(wrapped.some((call) => call.trim() === "kept")).toBe(true);
	});

	it("fails when a free reference uses the generated marker name", () => {
		const filename = "extra.tsx";
		const local = markerLocalName(filename);
		expect(() =>
			transformSource(
				`const local = ".a{color:red}";
				void ${local};
				export const view = <style>{local}</style>;`,
				filename,
			),
		).toThrow(
			/Marker references \(2\) outnumber marked <style> elements \(1\)/,
		);
	});

	it("rejects a template when its resolved files include the mark", () => {
		const mark = fileURLToPath(
			new URL(
				"../../ignite-renderer/dist/jsx/author-style-mark.es.js",
				import.meta.url,
			),
		);
		const dir = path.dirname(mark);
		const sources = [
			`const a = "x";
			const mod = import(\`${dir}/\${a}.es.js\`);
			export const view = <style>{".a{color:red}"}</style>;`,
			`const x = "x";
			const mod = require(\`${dir}/author-\${"style"}-\${x}.es.js\`);
			export const view = <style>{".a{color:red}"}</style>;`,
			`const a = "-style-mark";
			const mod = import(\`${dir}/author\${a}.es.js\`);
			export const view = <style>{".a{color:red}"}</style>;`,
		];
		for (const source of sources) {
			expect(source).not.toMatch(/author-style/);
			expect(() => transformSource(source, "resolved-glob.tsx")).toThrow(
				/cannot mark CSS/,
			);
		}
	});

	it("keeps a template whose resolved files are not the mark", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-safe-glob-"));
		writeFileSync(path.join(dir, "icon.es.js"), "export const icon = 1;\n");
		try {
			const output = transformSource(
				`const a = "icon";
				const mod = import(\`${dir}/\${a}.es.js\`);
				export const view = <style>{".a{color:red}"}</style>;`,
				"safe-glob.tsx",
			);
			expect(marks(output).some((call) => call.includes("color:red"))).toBe(
				true,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not trust a package.json name outside the resolved renderer", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-fake-renderer-"));
		writeFileSync(
			path.join(dir, "package.json"),
			`${JSON.stringify({ name: "@ignite-element/renderer" })}\n`,
		);
		writeFileSync(path.join(dir, "app.tsx"), "export {};\n");
		const mark = fileURLToPath(
			new URL(
				"../../ignite-renderer/dist/jsx/author-style-mark.es.js",
				import.meta.url,
			),
		);
		const relative = path.relative(dir, mark).split("\\").join("/");
		try {
			expect(() =>
				transformSource(
					`import { igniteAuthorStyle } from ${JSON.stringify(relative.startsWith(".") ? relative : `./${relative}`)};
					export const view = <style>{".a{color:red}"}</style>;`,
					path.join(dir, "app.tsx"),
				),
			).toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("allows the renderer source import of ./authorStyle", () => {
		const filename = fileURLToPath(
			new URL(
				"../../ignite-renderer/src/renderers/jsx/renderer.ts",
				import.meta.url,
			),
		);
		expect(() =>
			transformSource(
				`import { readAuthorStyle } from "./authorStyle";
				export const view = <div />;`,
				filename,
			),
		).not.toThrow();
		expect(() =>
			transformSource(
				`import { igniteAuthorStyle } from "./authorStyle";
				export const view = <style>{".a{color:red}"}</style>;`,
				path.join(tmpdir(), "app-author-style.tsx"),
			),
		).toThrow(/cannot mark CSS/);
		expect(() =>
			transformSource(
				`import { readAuthorStyle } from "pkg/authorStyle.js";
				export const view = <div />;`,
				filename,
			),
		).toThrow(/cannot mark CSS/);
		const elementFile = fileURLToPath(
			new URL(
				"../../ignite-element/src/renderers/ignite-jsx.ts",
				import.meta.url,
			),
		);
		expect(() =>
			transformSource(
				`import { readAuthorStyle } from "./authorStyle";
				export const view = <div />;`,
				elementFile,
			),
		).toThrow(/cannot mark CSS/);
		const link = path.join(tmpdir(), `ignite-author-link-${process.pid}.tsx`);
		symlinkSync(filename, link);
		try {
			expect(() =>
				transformSource(
					`import { readAuthorStyle } from "./authorStyle";
					export const view = <div />;`,
					link,
				),
			).toThrow(/cannot mark CSS/);
		} finally {
			rmSync(link, { force: true });
		}
	});

	it("keeps a template when no resolved file is the mark", () => {
		const missing = transformSource(
			`const a = "x";
			const mod = import(\`/no/such/ignite-mark-dir/\${a}.js\`);
			export const view = <style>{".a{color:red}"}</style>;`,
			"missing-glob.tsx",
		);
		expect(marks(missing).some((call) => call.includes("color:red"))).toBe(
			true,
		);
		const bare = transformSource(
			`const a = "x";
			const mod = import(\`\${a}.js\`);
			export const view = <style>{".a{color:red}"}</style>;`,
			"bare-glob.tsx",
		);
		expect(marks(bare).some((call) => call.includes("color:red"))).toBe(true);
		const dir = path.dirname(
			fileURLToPath(
				new URL(
					"../../ignite-renderer/dist/jsx/author-style-mark.es.js",
					import.meta.url,
				),
			),
		);
		const dottedSource = `const rest = "x";
			const mod = import(\`${dir}/.\${rest}\`);
			export const view = <style>{".a{color:red}"}</style>;`;
		expect(dottedSource).not.toMatch(/author-style/);
		const dotted = transformSource(dottedSource, "dotted-glob.tsx");
		expect(marks(dotted).some((call) => call.includes("color:red"))).toBe(true);
		const seamDir = mkdtempSync(path.join(tmpdir(), "ignite-read-seam-"));
		writeFileSync(
			path.join(seamDir, "author-style-read.es.js"),
			"export const read = 1;\n",
		);
		try {
			const output = transformSource(
				`const a = "x";
				const mod = import(\`${seamDir}/\${a}.es.js\`);
				export const view = <style>{".a{color:red}"}</style>;`,
				"read-seam-glob.tsx",
			);
			expect(marks(output).some((call) => call.includes("color:red"))).toBe(
				true,
			);
		} finally {
			rmSync(seamDir, { recursive: true, force: true });
		}
	});

	it("rejects a template whose static parts name the author mark", () => {
		expect(() =>
			transformSource(
				`const part = "mark";
				const mod = import(\`../node_modules/@ignite-element/renderer/dist/jsx/author-style-\${part}.es.js\`);
				export const view = <style>{".a{color:red}"}</style>;`,
				"template.tsx",
			),
		).toThrow(/author-style-\$\{...}\.es\.js" cannot mark CSS/);
	});

	it("rejects a specifier that only matches the author-style text", () => {
		expect(() =>
			transformSource(
				`import sheet from "lib/authorStyle.js";
				export const view = <style>{".a{color:red}"}</style>;`,
				"author-style-text.tsx",
			),
		).toThrow(/lib\/authorStyle\.js" cannot mark CSS/);
	});

	it("does not treat an ordinary call as an author import", () => {
		const output = transformSource(
			`helper("ignite-element/jsx/author-style");
			export const view = <style>{".a{color:red}"}</style>;`,
			"ordinary-call.tsx",
		);
		expect(marks(output).some((call) => call.includes("color:red"))).toBe(true);
	});

	it("still marks a const when eval is optional", () => {
		const output = transformSource(
			`const sheet = ".a{background:url(http://127.0.0.1:9/x.png)}";
			eval?.("sheet = '.stolen{}'");
			export const view = <style>{sheet}</style>;`,
			"optional-eval.tsx",
		);
		expect(marks(output).some((call) => call.trim() === "sheet")).toBe(true);
	});

	it("rejects a Babel ImportExpression that names the author mark", () => {
		const ast = parse(`export const view = <style>{".a{color:red}"}</style>;`, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
		});
		ast.program.body.push(
			t.expressionStatement(
				t.importExpression(t.stringLiteral("ignite-element/jsx/author-style")),
			),
		);
		expect(() => markFile(ast, "import-expression.tsx")).toThrow(
			/cannot mark CSS/,
		);
		const templated = parse(
			`export const view = <style>{".a{color:red}"}</style>;`,
			{ sourceType: "module", plugins: ["typescript", "jsx"] },
		);
		templated.program.body.push(
			t.expressionStatement(
				t.importExpression(
					t.templateLiteral(
						[
							t.templateElement({
								raw: "../node_modules/@ignite-element/renderer/dist/jsx/author-style-",
								cooked:
									"../node_modules/@ignite-element/renderer/dist/jsx/author-style-",
							}),
							t.templateElement({ raw: ".es.js", cooked: ".es.js" }, true),
						],
						[t.identifier("part")],
					),
				),
			),
		);
		expect(() => markFile(templated, "import-template.tsx")).toThrow(
			/cannot mark CSS/,
		);
	});
});
