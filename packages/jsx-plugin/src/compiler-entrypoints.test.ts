import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "@babel/core";
import esbuild from "esbuild";
import fc from "fast-check";
import ts from "typescript";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import igniteBabel from "./babel.js";
import igniteEsbuild from "./esbuild.js";
import { AUTHOR_STANDALONE, markerLocalName } from "./transform.js";
import igniteTypeScript from "./typescript.js";
import igniteJsx from "./unplugin.js";
import igniteVite from "./vite.js";

type Compiler = "babel" | "babel-dev" | "typescript" | "typescript-dev";
const compilers: Compiler[] = [
	"babel",
	"babel-dev",
	"typescript",
	"typescript-dev",
];
const css = ".a{background:url(https://cdn.example/static.png)}";

function compile(
	source: string,
	filename: string,
	compiler: Compiler,
	runtime?: string,
) {
	if (compiler === "babel" || compiler === "babel-dev") {
		return (
			transformSync(source, {
				filename,
				babelrc: false,
				configFile: false,
				parserOpts: { plugins: ["typescript", "jsx"] },
				presets: [
					[
						"@babel/preset-react",
						{
							runtime: "automatic",
							importSource: runtime,
							development: compiler === "babel-dev",
						},
					],
				],
				plugins: [igniteBabel],
			})?.code ?? ""
		);
	}
	return ts.transpileModule(source, {
		fileName: filename,
		compilerOptions: {
			jsx:
				compiler === "typescript-dev"
					? ts.JsxEmit.ReactJSXDev
					: ts.JsxEmit.ReactJSX,
			jsxImportSource: runtime,
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
		},
		transformers: { before: [igniteTypeScript()] },
	}).outputText;
}

async function bundle(entry: string) {
	const result = await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		write: false,
		format: "esm",
		external: [
			"react/jsx-runtime",
			"react/jsx-dev-runtime",
			"preact/jsx-runtime",
			"preact/jsx-dev-runtime",
			"ignite-element/jsx/jsx-runtime",
			"ignite-element/jsx/jsx-dev-runtime",
		],
		plugins: [igniteEsbuild()],
		logLevel: "silent",
	});
	return result.outputFiles[0].text;
}

describe("compiler entrypoint runtime and emitted-directory contracts", () => {
	it("keeps application compiler inputs separate from dependency and library artifacts", () => {
		const plugin = igniteJsx.raw(undefined, { framework: "rollup" });
		if (Array.isArray(plugin) || typeof plugin.transformInclude !== "function")
			throw new Error("missing source filter");
		for (const id of [
			"/app/dist/entry.js",
			"C:\\app\\dist\\entry.js",
			"/app/nested/dist/entry.js?compiler=ts",
		])
			expect(plugin.transformInclude(id)).toBe(true);
		for (const id of [
			"/app/node_modules/dependency/dist/entry.js",
			"C:\\app\\node_modules\\dependency\\dist\\entry.js",
			"/app/.ignite-jsx-shims/entry.js",
			"/app/dist/style.css",
		])
			expect(plugin.transformInclude(id)).toBe(false);
		const publicEntry = createRequire(
			new URL("../../ignite-element/package.json", import.meta.url),
		).resolve("ignite-element");
		expect(plugin.transformInclude(publicEntry)).toBe(false);
	});

	it.each(["prefix-transform-react-jsx", "transform-react-jsx-suffix"])(
		"Babel ignores an unrelated plugin named %s",
		(name) => {
			const code =
				transformSync('export const view = <style>{"color:red"}</style>;', {
					filename: "mixed.jsx",
					babelrc: false,
					configFile: false,
					presets: [
						[
							"@babel/preset-react",
							{ runtime: "automatic", importSource: "react" },
						],
					],
					plugins: [
						igniteBabel,
						[
							() => ({ name, visitor: {} }),
							{ importSource: "ignite-element/jsx" },
						],
					],
				})?.code ?? "";
			expect(code).not.toContain("igniteAuthorStyle");
		},
	);

	it("Babel classic mode ignores an empty automatic import source", () => {
		const code =
			transformSync('export const view = <style>{"color:red"}</style>;', {
				filename: "classic.jsx",
				babelrc: false,
				configFile: false,
				presets: [
					["@babel/preset-react", { runtime: "classic", importSource: "" }],
				],
				plugins: [igniteBabel],
			})?.code ?? "";
		expect(code).not.toContain("igniteAuthorStyle");
	});

	it("Babel preserves unrelated imports while emitting its private mark", () => {
		const code = compile(
			'import { value } from "unchanged"; export {value}; export const view = <style>{"color:red"}</style>;',
			"imports.tsx",
			"babel",
			"ignite-element/jsx",
		);
		expect(code).toContain('from "unchanged"');
		expect(code).toContain("not standalone");
	});

	it("Babel in-memory source resolves project runtime from its configured cwd", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-babel-cwd-"));
		try {
			writeFileSync(
				path.join(dir, "tsconfig.json"),
				'{"compilerOptions":{"jsxImportSource":"ignite-element/jsx"}}',
			);
			const code =
				transformSync('export const view = <style>{"color:red"}</style>;', {
					cwd: dir,
					babelrc: false,
					configFile: false,
					parserOpts: { plugins: ["jsx"] },
					plugins: [igniteBabel],
				})?.code ?? "";
			expect(code).toContain("igniteAuthorStyle");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
	it.each(compilers)(
		"%s honors a per-file pragma before compiler defaults",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiler-pragma-"));
			try {
				for (const runtime of ["react", "ignite-element/jsx"]) {
					const source = `/** @jsxImportSource ${runtime} */\nexport const view = <style>{${JSON.stringify(css)}}</style>;`;
					const configured =
						runtime === "react" ? "ignite-element/jsx" : "react";
					const code = compile(
						source,
						path.join(dir, "entry.tsx"),
						compiler,
						configured,
					);
					expect(code.includes("igniteAuthorStyle")).toBe(
						runtime === "ignite-element/jsx",
					);
					writeFileSync(path.join(dir, "entry.js"), code);
					const output = await bundle(path.join(dir, "entry.js"));
					expect(output.includes("ignite-element.authorStyle")).toBe(
						runtime === "ignite-element/jsx",
					);
				}
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it.each([undefined, "react", "ignite-element/jsx"])(
		"Babel preserve mode follows project runtime (%s)",
		(runtime) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-babel-project-"));
			try {
				if (runtime)
					writeFileSync(
						path.join(dir, "tsconfig.json"),
						JSON.stringify({ compilerOptions: { jsxImportSource: runtime } }),
					);
				const source = `export const view = <style>{${JSON.stringify(css)}}</style>;`;
				const code =
					transformSync(source, {
						filename: path.join(dir, "entry.tsx"),
						babelrc: false,
						configFile: false,
						parserOpts: { plugins: ["typescript", "jsx"] },
						plugins: [igniteBabel],
					})?.code ?? "";
				expect(code.includes("igniteAuthorStyle")).toBe(
					runtime === "ignite-element/jsx",
				);
				if (runtime === "ignite-element/jsx") {
					const compiled = compile(
						source,
						path.join(dir, "entry.tsx"),
						"babel",
						"react",
					);
					expect(compiled).not.toContain("igniteAuthorStyle");
				}
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it("Babel classic React output retains ordinary stylesheet strings", () => {
		const code =
			transformSync(
				`export const view = <style>{${JSON.stringify(css)}}</style>;`,
				{
					filename: "classic.jsx",
					babelrc: false,
					configFile: false,
					presets: [["@babel/preset-react", { runtime: "classic" }]],
					plugins: [igniteBabel],
				},
			)?.code ?? "";
		expect(code).not.toContain("igniteAuthorStyle");
		expect(code).toContain(css);
	});

	it.each([undefined, "react", "ignite-element/jsx"])(
		"TypeScript preserve mode follows compiler runtime (%s)",
		(runtime) => {
			const code = ts.transpileModule(
				`export const view = <style>{${JSON.stringify(css)}}</style>;`,
				{
					fileName: "preserve.tsx",
					compilerOptions: {
						jsx: ts.JsxEmit.Preserve,
						jsxImportSource: runtime,
						target: ts.ScriptTarget.ESNext,
						module: ts.ModuleKind.ESNext,
					},
					transformers: { before: [igniteTypeScript()] },
				},
			).outputText;
			expect(code.includes("igniteAuthorStyle")).toBe(
				runtime === "ignite-element/jsx",
			);
		},
	);
	it.each(compilers)(
		"%s never marks non-Ignite compiler output",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiler-runtime-"));
			try {
				await fc.assert(
					fc.asyncProperty(
						fc.constantFrom(undefined, "react", "preact"),
						async (runtime) => {
							const code = compile(
								`export const view = <style>{${JSON.stringify(css)}}</style>;`,
								path.join(dir, "entry.tsx"),
								compiler,
								runtime,
							);
							expect(code).not.toContain("igniteAuthorStyle");
							const entry = path.join(dir, "entry.js");
							writeFileSync(entry, code);
							const output = await bundle(entry);
							expect(output).not.toContain("ignite-element.authorStyle");
							expect(output).toContain(css);
						},
					),
					{ seed: 1802, numRuns: 8 },
				);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it.each(compilers)(
		"%s author marks are adopted from application dist directories",
		async (compiler) => {
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-compiler-dist-"));
			try {
				const code = compile(
					`export const view = <style>{${JSON.stringify(css)}}</style>;`,
					path.join(dir, "src", "entry.tsx"),
					compiler,
					"ignite-element/jsx",
				);
				expect(code).toContain("not standalone");
				for (const outputDir of ["dist", "nested/dist"]) {
					const entry = path.join(dir, outputDir, "entry.js");
					mkdirSync(path.dirname(entry), { recursive: true });
					writeFileSync(entry, code);
					const output = await bundle(entry);
					expect(output).toContain("ignite-element.authorStyle");
					expect(output).toContain(css);
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
					).toContain("ignite-element.authorStyle");
				}
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		},
	);

	it("dist output cannot use dynamic or misplaced author marks", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-dist-closed-"));
		try {
			const entry = path.join(dir, "dist", "entry.js");
			mkdirSync(path.dirname(entry));
			const local = markerLocalName("source.tsx");
			for (const body of [
				`make("style", {children: ${local}(caller.css)})`,
				`make("div", {children: ${local}("color:red")})`,
				`${local}("color:red")`,
			]) {
				writeFileSync(
					entry,
					`import {jsx as make} from "ignite-element/jsx/jsx-runtime"; import {igniteAuthorStyle as ${local}} from ${JSON.stringify(AUTHOR_STANDALONE)}; export const view = ${body};`,
				);
				await expect(bundle(entry)).rejects.toThrow(/cannot mark CSS/);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
