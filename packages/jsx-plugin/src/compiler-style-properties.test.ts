import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "@babel/core";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import esbuild from "esbuild";
import fc from "fast-check";
import ts from "typescript";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import igniteBabel from "./babel.js";
import igniteEsbuild from "./esbuild.js";
import {
	AUTHOR_STANDALONE,
	markerLocalName,
	transformSource,
} from "./transform.js";
import igniteTypeScript from "./typescript.js";
import igniteVite from "./vite.js";

type Compiler = "babel" | "babel-dev" | "typescript" | "typescript-dev";
const compilers: Compiler[] = [
	"babel",
	"babel-dev",
	"typescript",
	"typescript-dev",
];
const cssValues = [
	".a{background:url(https://cdn.example/a.png)}",
	"",
	".q{content:'λ';color:red}",
	'.a{content:"line\\a break"}',
] as const;
const styleTags = ["style", "x:style", "svg:style"] as const;
const targets = [
	undefined,
	ts.ScriptTarget.ES5,
	ts.ScriptTarget.ES2015,
	ts.ScriptTarget.ESNext,
];

function compile(
	source: string,
	compiler: Compiler,
	target?: ts.ScriptTarget,
	preserve = false,
): string {
	if (compiler.startsWith("babel")) {
		const code =
			transformSync(source, {
				filename: "entry.jsx",
				babelrc: false,
				configFile: false,
				presets: [
					[
						"@babel/preset-react",
						{
							runtime: "automatic",
							importSource: "ignite-element/jsx",
							development: compiler === "babel-dev",
							throwIfNamespace: false,
						},
					],
				],
				plugins: [igniteBabel],
			})?.code ?? "";
		return target === undefined
			? code
			: ts.transpileModule(code, {
					compilerOptions: { target, module: ts.ModuleKind.ESNext },
				}).outputText;
	}
	return ts.transpileModule(source, {
		fileName: "entry.tsx",
		compilerOptions: {
			jsx: preserve
				? ts.JsxEmit.Preserve
				: compiler === "typescript-dev"
					? ts.JsxEmit.ReactJSXDev
					: ts.JsxEmit.ReactJSX,
			jsxImportSource: "ignite-element/jsx",
			target,
			module: ts.ModuleKind.ESNext,
		},
		transformers: { before: [igniteTypeScript()] },
	}).outputText;
}

function adopt(code: string, preserve = false): string {
	return transformSource(code, preserve ? "dist/entry.jsx" : "dist/entry.js", {
		jsxImportSource: "ignite-element/jsx",
	});
}

function staticSource(
	css: string,
	shape: "literal" | "template" | "alias",
	tag: string,
): string {
	const init =
		shape === "template"
			? `\`${css.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${")}\``
			: JSON.stringify(css);
	return `const sheet = ${init}; const alias = sheet; export const view = <${tag}>{${shape === "alias" ? "alias" : "sheet"}}</${tag}>;`;
}

function markerCount(code: string): number {
	return [...code.matchAll(/_igniteAuthor\$[0-9a-f]{8}\(/g)].length;
}

function markedValues(code: string): Array<string | undefined> {
	const values: Array<string | undefined> = [];
	t.traverseFast(
		parse(code, { sourceType: "module", plugins: ["jsx"] }),
		(node) => {
			if (
				node.type === "CallExpression" &&
				node.callee.type === "Identifier" &&
				/^_igniteAuthor\$[0-9a-f]{8}$/.test(node.callee.name)
			) {
				const arg = node.arguments[0];
				values.push(arg?.type === "StringLiteral" ? arg.value : undefined);
			}
		},
	);
	return values;
}

describe("compiler author CSS invariants", () => {
	it.each(compilers)(
		"%s always preserves validated constants across downleveling",
		(compiler) => {
			fc.assert(
				fc.property(
					fc.constantFrom(...cssValues),
					fc.constantFrom("literal", "template", "alias"),
					(css, shape) => {
						for (const target of targets) {
							const emitted = compile(
								staticSource(css, shape, "style"),
								compiler,
								target,
							);
							expect(markerCount(emitted)).toBe(1);
							const adopted = adopt(emitted);
							expect(markerCount(adopted)).toBe(1);
							expect(markedValues(adopted)).toEqual([css]);
							expect(adopt(adopted)).toBe(adopted);
						}
					},
				),
				{ seed: 1803, numRuns: 24 },
			);
		},
	);

	it.each(compilers)(
		"%s always adopts plain and prefixed static style tags",
		(compiler) => {
			fc.assert(
				fc.property(
					fc.constantFrom(...styleTags),
					fc.constantFrom(...cssValues.filter(Boolean)),
					(tag, css) => {
						const emitted = compile(
							`export const view = <${tag}>{${JSON.stringify(css)}}</${tag}>;`,
							compiler,
							ts.ScriptTarget.ESNext,
						);
						expect(markerCount(emitted)).toBe(1);
						expect(markerCount(adopt(emitted))).toBe(1);
					},
				),
				{ seed: 1803, numRuns: 18 },
			);
		},
	);

	it("TypeScript preserves prefixed JSX and aligns mixed static/dynamic sibling styles", () => {
		const code = compile(
			'export const view = <div><x:style>{"color:red"}</x:style><style>{input}</style><style>{"color:blue"}</style></div>;',
			"typescript",
			undefined,
			true,
		);
		expect(markerCount(code)).toBe(2);
		expect(code).toMatch(/<x:style>\{_igniteAuthor/);
		expect(code).toContain("<style>{input}</style>");
		expect(markerCount(adopt(code, true))).toBe(2);
	});

	it("TypeScript preserves side-effect and named raw imports alongside marked styles", () => {
		const source =
			'import "./side.css?raw"; import { value } from "./named.css?raw"; export {value}; export const view = <style>{"color:red"}</style>;';
		const code = compile(source, "typescript", ts.ScriptTarget.ES5);
		expect(code).toContain('import "./side.css?raw";');
		expect(code).toContain('import { value } from "./named.css?raw";');
		expect(code.match(/named.css/g)).toHaveLength(1);
		expect(markerCount(adopt(code))).toBe(1);
	});

	it.each(compilers)(
		"%s preserves raw-CSS aliases without capturing shadowed names",
		(compiler) => {
			const source =
				'import sheet from "./sheet.css?raw"; const alias = sheet; export function view(sheet) { return <x:style>{alias}</x:style>; }';
			const code = compile(source, compiler, ts.ScriptTarget.ES5);
			expect(markerCount(code)).toBe(1);
			expect(markerCount(adopt(code))).toBe(1);
		},
	);

	it.each(compilers)(
		"%s never promotes mutable bindings, dynamic values, or non-style tags",
		(compiler) => {
			fc.assert(
				fc.property(
					fc.constantFrom(...styleTags),
					fc.constantFrom(
						"let sheet = 'color:red';",
						"var sheet = 'color:red';",
						"let mutable = 'color:red'; const sheet = mutable;",
						"const sheet = input;",
						"const sheet = `color:${input}`;",
						"const sheet = 'color:red'; eval(input);",
					),
					(tag, declaration) => {
						const code = compile(
							`${declaration} export const view = <${tag}>{sheet}</${tag}>;`,
							compiler,
							ts.ScriptTarget.ES5,
						);
						expect(code).not.toContain("igniteAuthorStyle");
						expect(adopt(code)).not.toContain("igniteAuthorStyle");
					},
				),
				{ seed: 1803, numRuns: 24 },
			);
			for (const tag of [
				"div",
				"x:div",
				"x:Style",
				"stylesheet",
				"Icons.style",
			]) {
				const code = compile(
					`export const view = <${tag}>{"color:red"}</${tag}>;`,
					compiler,
				);
				expect(code).not.toContain("igniteAuthorStyle");
			}
		},
	);

	it("emitted marks never trust mutable application bindings or non-style call targets", () => {
		const local = markerLocalName("entry.tsx");
		fc.assert(
			fc.property(
				fc.constantFrom("let", "var"),
				fc.constantFrom(...styleTags),
				(kind, tag) => {
					const code = `import {jsx} from "ignite-element/jsx/jsx-runtime"; import {igniteAuthorStyle as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)}; ${kind} sheet = "color:red"; export const view = jsx(${JSON.stringify(tag)}, {children: ${local}(sheet)});`;
					expect(() => adopt(code)).toThrow(/cannot mark CSS/);
				},
			),
			{ seed: 1803, numRuns: 12 },
		);
		for (const tag of [
			"div",
			"x:div",
			"x:Style",
			"stylesheet",
			"style:x",
			"mystyle",
			"x:mystyle",
		]) {
			const code = `import {jsx} from "ignite-element/jsx/jsx-runtime"; import {igniteAuthorStyle as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)}; export const view = jsx(${JSON.stringify(tag)}, {children: ${local}("color:red")});`;
			expect(() => adopt(code)).toThrow(/cannot mark CSS/);
		}
	});

	it.each(compilers)(
		"%s preserves the runtime CSS value across alias scopes",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiler-alias-"));
			try {
				const entry = path.join(dir, "entry.js");
				writeFileSync(path.join(dir, "sheet.css"), cssValues[0]);
				for (const source of [
					staticSource(cssValues[0], "alias", "x:style").replace(
						"export const view =",
						"export function view() { return",
					) + "}",
					'import sheet from "./sheet.css?raw"; const first = sheet; const alias = first; export function view(sheet, _igniteCss) { return <x:style>{alias}</x:style>; }',
					'import sheet from "./sheet.css?raw"; const alias = sheet; export function view() { return <style>{alias}</style>; }',
				]) {
					writeFileSync(entry, compile(source, compiler, ts.ScriptTarget.ES5));
					const result = await esbuild.build({
						entryPoints: [entry],
						bundle: true,
						write: false,
						format: "cjs",
						external: [
							"ignite-element/jsx/jsx-runtime",
							"ignite-element/jsx/jsx-dev-runtime",
						],
						plugins: [igniteEsbuild()],
						logLevel: "silent",
					});
					const module = {
						exports: {
							view: (
								_sheet: string,
								_other: string,
							): { props: { children: object } } => {
								throw new Error("fixture did not export view");
							},
						},
					};
					const jsx = (_tag: string, props: object) => ({ props });
					new Function(
						"require",
						"module",
						"exports",
						result.outputFiles[0].text,
					)(
						(specifier: string) => {
							expect(specifier).toMatch(
								/^ignite-element\/jsx\/jsx-(?:dev-)?runtime$/,
							);
							return { jsx, jsxs: jsx, jsxDEV: jsx };
						},
						module,
						module.exports,
					);
					const child = module.exports.view("untrusted", "also untrusted").props
						.children;
					expect(Object.isFrozen(child)).toBe(true);
					expect(
						Reflect.ownKeys(child).map(
							(key) => Object.getOwnPropertyDescriptor(child, key)?.value,
						),
					).toEqual([cssValues[0]]);
				}
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it.each(compilers)(
		"%s bundles downleveled constants and prefixed styles through esbuild and Vite",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiler-static-"));
			try {
				const entry = path.join(dir, "dist", "entry.js");
				mkdirSync(path.dirname(entry));
				const source = staticSource(cssValues[0], "alias", "x:style");
				writeFileSync(entry, compile(source, compiler, ts.ScriptTarget.ES5));
				const output = await esbuild.build({
					entryPoints: [entry],
					bundle: true,
					write: false,
					format: "esm",
					external: [
						"ignite-element/jsx/jsx-runtime",
						"ignite-element/jsx/jsx-dev-runtime",
					],
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				});
				expect(output.outputFiles[0].text).toContain(cssValues[0]);
				expect(output.outputFiles[0].text).toContain(
					"ignite-element.authorStyle",
				);
				const result = await build({
					configFile: false,
					root: dir,
					logLevel: "silent",
					plugins: [igniteVite()],
					build: {
						write: false,
						minify: false,
						lib: { entry, formats: ["es"] },
						rollupOptions: { external: [/\/jsx-(?:dev-)?runtime$/] },
					},
				});
				const chunk = Array.isArray(result) ? result[0] : result;
				if (!("output" in chunk)) throw new Error("missing Vite output");
				expect(
					chunk.output
						.map((item) => ("code" in item ? item.code : ""))
						.join("\n"),
				).toContain(cssValues[0]);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);
});
