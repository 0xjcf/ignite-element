import { describe, expect, it } from "vitest";
import { transformSource } from "./transform.js";

const AUTHOR = 'from "ignite-element/jsx/author-style"';

function marks(code: string): string[] {
	const found: string[] = [];
	let index = 0;
	const token = "igniteAuthorStyle(";
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
		expect(output).not.toMatch(
			/igniteAuthorStyle\(\s*`[^`]*\$\{props\.image\}/,
		);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*props\.cardCss\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*shadow\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*other\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*sheet\s*\)/);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*ns\./);
		expect(output).not.toMatch(/igniteAuthorStyle\(\s*joined\s*\)/);
		expect(output).not.toContain("card.css?inline");
		const shadowFn = output.slice(output.indexOf("function Shadow"));
		expect(shadowFn).not.toContain("igniteAuthorStyle(");
	});

	it("reuses an existing compiler import and fails on another binding", () => {
		const reused = transformSource(
			`import { igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{background:url(https://cdn.example/a.png)}";
			export const view = <style>{local}</style>;`,
			"reuse.tsx",
		);
		expect(reused.match(/ignite-element\/jsx\/author-style/g)).toHaveLength(1);
		expect(marks(reused).some((call) => call.includes("local"))).toBe(true);

		expect(() =>
			transformSource(
				`const igniteAuthorStyle = (css: string) => css;
				const local = ".a{}";
				export const view = <style>{local}</style>;`,
				"conflict.tsx",
			),
		).toThrow(/already declared/);
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
		const authorAt = withImports.indexOf("ignite-element/jsx/author-style");
		expect(authorAt).toBeGreaterThan(withImports.indexOf("use client"));
		expect(authorAt).toBeGreaterThan(withImports.indexOf("card.css?raw"));
		expect(authorAt).toBeLessThan(withImports.indexOf("void 0"));
		expect(withImports).toContain(
			'import { igniteAuthorStyle } from "ignite-element/jsx/author-style"',
		);

		const directiveOnly = transformSource(
			`"use client";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"directive.tsx",
		);
		expect(directiveOnly.indexOf("use client")).toBeLessThan(
			directiveOnly.indexOf("ignite-element/jsx/author-style"),
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
		expect(output.split("\n")[styleLine]).toContain("igniteAuthorStyle");
	});

	it("leaves a file without a style element unchanged", () => {
		const source = "export const n = 1;\n";
		expect(transformSource(source, "plain.ts")).toBe(source);
	});

	it("marks static wrappers, text, aliases, and raw query variants", () => {
		const directStyle = "<style>{`.direct{color:red}`}</style>";
		const output = transformSource(
			`			import { igniteAuthorStyle as mark } from "ignite-element/jsx/author-style";
			import rawInline from "./card.css?raw&inline";
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
					<div>{local}</div>
					<Foo.style>{local}</Foo.style>
					<ns:div>{local}</ns:div>
				</div>
			);`,
			"wrappers.tsx",
		);
		expect(
			output.match(/from "ignite-element\/jsx\/author-style"/g),
		).toHaveLength(1);
		expect(output).toContain("mark(");
		expect(output).not.toMatch(/igniteAuthorStyle\(/);
		const wrapped = marks(output.replaceAll("mark(", "igniteAuthorStyle("));
		expect(wrapped.some((call) => call.includes(".pre-color-red"))).toBe(true);
		expect(wrapped.some((call) => call === '"ab"' || call === "'ab'")).toBe(
			true,
		);
		expect(wrapped.some((call) => call.includes(".direct{color:red}"))).toBe(
			true,
		);
		expect(wrapped.some((call) => call.includes("rawInline"))).toBe(true);
		expect(wrapped.some((call) => call.includes("live"))).toBe(true);
		expect(wrapped.some((call) => call.includes("old"))).toBe(true);
		expect(
			wrapped.filter((call) => call.includes("local")).length,
		).toBeGreaterThan(5);
		const joined = wrapped.find(
			(call) => call.includes('"a"') || call.includes("'a'"),
		);
		expect(joined).toMatch(/local/);
		expect(output).not.toMatch(/mark\(\s*\)/);
		const div = output.slice(
			output.indexOf("<div>{"),
			output.indexOf("</div>"),
		);
		expect(div).not.toContain("mark(");
		expect(output).not.toMatch(/<Foo\.style>\{mark\(/);
		expect(output).not.toMatch(/<ns:div>\{mark\(/);
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
			`import { igniteAuthorStyle } from "elsewhere";
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
				expect(String(error)).toMatch(/already declared/);
				continue;
			}
			expect(output, source).not.toContain("igniteAuthorStyle(");
		}
	});

	it("adds a value import when the only compiler binding is a type", () => {
		const typeOnly = transformSource(
			`import type { igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"type-only.tsx",
		);
		expect(typeOnly).toContain(
			'import { igniteAuthorStyle } from "ignite-element/jsx/author-style"',
		);
		expect(marks(typeOnly).some((call) => call.includes("local"))).toBe(true);

		const inlineType = transformSource(
			`import { type igniteAuthorStyle } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"inline-type.tsx",
		);
		expect(inlineType).toContain(
			'import { igniteAuthorStyle } from "ignite-element/jsx/author-style"',
		);

		const otherName = transformSource(
			`import { other as mark } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"other-name.tsx",
		);
		expect(otherName).toContain(
			'import { igniteAuthorStyle } from "ignite-element/jsx/author-style"',
		);
		expect(marks(otherName).some((call) => call.includes("local"))).toBe(true);

		const defaultImport = transformSource(
			`import cardCss from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"default-import.tsx",
		);
		expect(defaultImport).toContain(
			'import { igniteAuthorStyle } from "ignite-element/jsx/author-style"',
		);
		expect(marks(defaultImport).some((call) => call.includes("local"))).toBe(
			true,
		);

		const stringImport = transformSource(
			`import { "igniteAuthorStyle" as mark } from "ignite-element/jsx/author-style";
			const local = ".a{color:red}";
			export const view = <style>{local}</style>;`,
			"string-import.tsx",
		);
		expect(stringImport).toContain("mark(");
		expect(
			stringImport.match(/ignite-element\/jsx\/author-style/g),
		).toHaveLength(1);
	});
});
