import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "@babel/core";
import esbuild from "esbuild";
import fc from "fast-check";
import ts from "typescript";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import igniteJsxBabel from "./babel.js";
import igniteEsbuild from "./esbuild.js";
import {
	AUTHOR_STANDALONE,
	markerLocalName,
	projectJsxImportSource,
	transformSource,
} from "./transform.js";
import igniteJsxTypeScript from "./typescript.js";
import igniteVite from "./vite.js";

const css = ".a{background:url(https://cdn.example/author.png)}";

describe("PR 180 compiler and runtime regressions", () => {
	it("adopts only the supported static automatic-runtime call shapes", () => {
		const local = markerLocalName("original.tsx");
		const filename = "elsewhere/emitted.js";
		const prefix = (
			runtime: string,
			imported = "jsx",
		) => `/** @jsxImportSource ignite-element/jsx */
import {${imported} as make} from ${JSON.stringify(runtime)};
import {"igniteAuthorStyle" as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)};`;
		fc.assert(
			fc.property(
				fc.constantFrom("jsx", "jsxs", "jsxDEV", '"jsx"'),
				fc.boolean(),
				fc.boolean(),
				(factory, quoted, sibling) => {
					const runtime =
						factory === "jsxDEV"
							? "ignite-element/jsx/jsx-dev-runtime"
							: "ignite-element/jsx/jsx-runtime";
					const source = `${prefix(runtime, factory)}
export const view = make("style", {${sibling ? '"id":"sheet",' : ""}${quoted ? '"children"' : "children"}: ${local}(".a{color:red}")});`;
					const output = transformSource(source, filename);
					expect(output).not.toContain("not standalone");
					expect(transformSource(output, filename)).toBe(output);
				},
			),
			{ seed: 180, numRuns: 48 },
		);
		const invalid = [
			'make("style", {other: MARK("color:red")})',
			'make("style", {["children"]: MARK("color:red")})',
			'make("style", {children: MARK("color:red"), "children": props.css})',
			'make("style", {"children": MARK("color:red"), children: props.css})',
			'make("style", {nested: {children: MARK("color:red")}})',
			'make(tag, {children: MARK("color:red")})',
			'make({children: MARK("color:red")}, "style")',
			'namespace.make("style", {children: MARK("color:red")})',
			'(function(make) { return make("style", {children: MARK("color:red")}); })(caller)',
		];
		for (const body of invalid) {
			expect(() =>
				transformSource(
					`${prefix("ignite-element/jsx/jsx-runtime")} export const view = ${body.replaceAll("MARK", local)};`,
					filename,
				),
			).toThrow(/cannot mark CSS/);
		}
		for (const runtime of [
			"react/jsx-runtime",
			"prefix/ignite-element/jsx/jsx-runtime",
			"ignite-element/jsx/jsx-runtime/extra",
		]) {
			expect(() =>
				transformSource(
					`${prefix(runtime)} export const view = make("style", {children: ${local}("color:red")});`,
					filename,
				),
			).toThrow(/cannot mark CSS/);
		}
		for (const imported of ["Fragment", "other"]) {
			expect(() =>
				transformSource(
					`${prefix("ignite-element/jsx/jsx-runtime", imported)} export const view = make("style", {children: ${local}("color:red")});`,
					filename,
				),
			).toThrow(/cannot mark CSS/);
		}
		expect(() =>
			transformSource(
				`${prefix("ignite-element/jsx/jsx-runtime")} make = caller; export const view = make("style", {children: ${local}("color:red")});`,
				filename,
			),
		).toThrow(/cannot mark CSS/);
	});

	it("infers emitted runtimes without requiring a preserved pragma", () => {
		for (const runtime of [
			"react/jsx-runtime",
			"react/jsx-dev-runtime",
			"preact/jsx-runtime",
		]) {
			const source = `import {jsx} from "${runtime}"; export const view = <style>{"color:red"}</style>;`;
			expect(transformSource(source, "mixed.tsx")).toBe(source);
		}
		for (const runtime of [
			"ignite-element/jsx/jsx-runtime",
			"ignite-element/jsx/jsx-dev-runtime",
		]) {
			const source = `import {jsx} from "${runtime}"; export const view = <style>{"color:red"}</style>;`;
			expect(transformSource(source, "ignite.tsx")).toContain(
				"igniteAuthorStyle",
			);
		}
	});

	it("uses jsconfig and defaults a project without compiler options to React", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-jsconfig-"));
		try {
			const filename = path.join(dir, "entry.jsx");
			writeFileSync(
				path.join(dir, "jsconfig.json"),
				'{"compilerOptions":{"jsxImportSource":"ignite-element/jsx"}}',
			);
			expect(projectJsxImportSource(filename)).toBe("ignite-element/jsx");
			writeFileSync(path.join(dir, "jsconfig.json"), "{}");
			expect(projectJsxImportSource(filename)).toBe("react");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
	it.each([undefined, "react"])(
		"never lets a fallback override React's project or toolchain (%s)",
		async (runtime) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-fallback-"));
			try {
				writeFileSync(
					path.join(dir, "tsconfig.json"),
					'{"compilerOptions":{"jsxImportSource":"react"}}',
				);
				writeFileSync(
					path.join(dir, "entry.tsx"),
					`export const view = <style>{${JSON.stringify(css)}}</style>;`,
				);
				const result = await esbuild.build({
					absWorkingDir: dir,
					entryPoints: ["entry.tsx"],
					bundle: true,
					write: false,
					format: "esm",
					jsx: "automatic",
					jsxImportSource: runtime,
					packages: "external",
					plugins: [igniteEsbuild({ jsxImportSource: "ignite-element/jsx" })],
					logLevel: "silent",
				});
				expect(result.outputFiles[0].text).not.toContain(
					"ignite-element.authorStyle",
				);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);
	it.each(["react", "ignite-element/jsx"])(
		"respects Vite's configured runtime (%s)",
		async (runtime) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-vite-runtime-"));
			try {
				writeFileSync(
					path.join(dir, "entry.tsx"),
					`export const view = <style>{${JSON.stringify(css)}}</style>;`,
				);
				const result = await build({
					configFile: false,
					root: dir,
					logLevel: "silent",
					plugins: [igniteVite()],
					esbuild: { jsx: "automatic", jsxImportSource: runtime },
					build: {
						write: false,
						minify: false,
						lib: { entry: path.join(dir, "entry.tsx"), formats: ["es"] },
						rollupOptions: { external: [/\/jsx-(?:dev-)?runtime$/] },
					},
				});
				const chunk = Array.isArray(result) ? result[0] : result;
				if (!("output" in chunk)) throw new Error("missing Vite output");
				const code = chunk.output
					.map((item) => ("code" in item ? item.code : ""))
					.join("\n");
				expect(code.includes("ignite-element.authorStyle")).toBe(
					runtime === "ignite-element/jsx",
				);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);
	it("never adopts dynamic or misplaced compiled marks", () => {
		const filename = "closed.js";
		const local = markerLocalName(filename);
		fc.assert(
			fc.property(
				fc.constantFrom("props.css", "readCss()", "mutable"),
				fc.constantFrom("style", "div"),
				(value, tag) => {
					const source = `import {jsx as make} from "ignite-element/jsx/jsx-runtime";
import {igniteAuthorStyle as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)};
let mutable = ${JSON.stringify(css)};
export const view = make(${JSON.stringify(tag)}, {children: ${local}(${value})});`;
					expect(() => transformSource(source, filename)).toThrow(
						/cannot mark CSS/,
					);
				},
			),
			{ seed: 180, numRuns: 24 },
		);
		for (const body of [
			`make("div", {children: ${local}("color:red")})`,
			`make("style", {...props, children: ${local}("color:red")})`,
			`make("style", {children: ${local}("color:red"), children: props.css})`,
			`${local}("color:red")`,
		]) {
			expect(() =>
				transformSource(
					`import {jsx as make} from "ignite-element/jsx/jsx-runtime";
import {igniteAuthorStyle as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)};
export const view = ${body};`,
					filename,
				),
			).toThrow(/cannot mark CSS/);
		}
	});

	it("keeps author styles selected by inherited project configuration", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-project-"));
		try {
			writeFileSync(
				path.join(dir, "base.json"),
				'{// JSX runtime\n"compilerOptions":{"jsxImportSource":"ignite-element/jsx",},}',
			);
			writeFileSync(
				path.join(dir, "tsconfig.json"),
				'{"extends":"./base.json"}',
			);
			writeFileSync(
				path.join(dir, "entry.tsx"),
				`export const view = <style>{${JSON.stringify(css)}}</style>;`,
			);
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			expect(result.outputFiles[0].text).toContain(
				"ignite-element.authorStyle",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
	it.each([undefined, "react", "preact"])(
		"keeps unannotated non-Ignite JSX unchanged (%s)",
		async (runtime) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-runtime-"));
			try {
				if (runtime) {
					writeFileSync(
						path.join(dir, "base.json"),
						`{// inherited runtime\n"compilerOptions":{"jsx":"react-jsx","jsxImportSource":${JSON.stringify(runtime)},},}`,
					);
					writeFileSync(
						path.join(dir, "tsconfig.json"),
						'{"extends":"./base.json"}',
					);
				}
				writeFileSync(
					path.join(dir, "entry.tsx"),
					`export const view = <style>{${JSON.stringify(css)}}</style>;`,
				);
				const result = await esbuild.build({
					absWorkingDir: dir,
					entryPoints: ["entry.tsx"],
					bundle: true,
					write: false,
					format: "esm",
					jsx: "automatic",
					packages: "external",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				});
				const output = result.outputFiles[0].text;
				expect(output).not.toContain("ignite-element.authorStyle");
				expect(output).toContain(css);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it.each(["babel", "typescript", "typescript-dev"])(
		"adopts lowered %s output after the output extension changes",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiled-"));
			try {
				const filename = path.join(dir, "src", "entry.tsx");
				mkdirSync(path.join(dir, "out"));
				const source = `/** @jsxImportSource ignite-element/jsx */\nconst local = ${JSON.stringify(css)}; export const view = <style>{local}</style>;`;
				const code =
					compiler === "babel"
						? (transformSync(source, {
								filename,
								babelrc: false,
								configFile: false,
								parserOpts: { plugins: ["typescript", "jsx"] },
								presets: [
									[
										"@babel/preset-react",
										{
											runtime: "automatic",
											importSource: "ignite-element/jsx",
										},
									],
								],
								plugins: [igniteJsxBabel],
							})?.code ?? "")
						: ts.transpileModule(source, {
								fileName: filename,
								compilerOptions: {
									jsx:
										compiler === "typescript-dev"
											? ts.JsxEmit.ReactJSXDev
											: ts.JsxEmit.ReactJSX,
									jsxImportSource: "ignite-element/jsx",
									target: ts.ScriptTarget.ESNext,
									module: ts.ModuleKind.ESNext,
								},
								transformers: { before: [igniteJsxTypeScript()] },
							}).outputText;
				expect(code).not.toContain("<style>");
				expect(code).toContain("not standalone");
				expect(() =>
					transformSource(code, path.join(dir, "out", "entry.js")),
				).not.toThrow();
				writeFileSync(path.join(dir, "out", "entry.js"), code);
				const result = await esbuild.build({
					absWorkingDir: dir,
					entryPoints: ["out/entry.js"],
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
				expect(result.outputFiles[0].text).toContain(
					"ignite-element.authorStyle",
				);
				expect(result.outputFiles[0].text).toContain(css);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);
});
