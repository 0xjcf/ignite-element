import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import * as rspack from "@rspack/core";
import esbuild from "esbuild";
import fc from "fast-check";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import webpack from "webpack";
import igniteEsbuild from "./esbuild.js";
import igniteRspack from "./rspack.js";
import igniteVite from "./vite.js";
import igniteWebpack from "./webpack.js";

// Operator-reviewed rules R1-R5, 2026-11-09. Build observations are the oracle;
// these properties do not import scanner predicates or a production rule model.
const profile = { seed: 20261109, numRuns: 8 };
const CSS = ".a{background:url(http://127.0.0.1:9/x.png)}";

async function fixture(
	files: Record<string, string>,
	check: (dir: string) => Promise<void>,
) {
	const dir = realpathSync(
		mkdtempSync(path.join(tmpdir(), "ignite-guard-correction-")),
	);
	try {
		for (const [name, source] of Object.entries(files)) {
			const file = path.join(dir, name);
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, source);
		}
		await check(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function esbuildBuild(dir: string, entry = "entry.cjs") {
	return esbuild.build({
		absWorkingDir: dir,
		entryPoints: [path.join(dir, entry)],
		bundle: true,
		write: false,
		format: "esm",
		platform: "node",
		plugins: [igniteEsbuild()],
		logLevel: "silent",
	});
}

function viteBuild(dir: string, entry = "entry.cjs") {
	return build({
		configFile: false,
		logLevel: "silent",
		root: dir,
		plugins: [igniteVite()],
		build: { ssr: path.join(dir, entry), write: false, minify: false },
	});
}

async function ordinaryBuild(dir: string, entry = "entry.cjs") {
	await esbuildBuild(dir, entry);
	await viteBuild(dir, entry);
}

describe("reviewed guard correction rules", () => {
	it("R1: real mark loads stay refused, including nested sequence loads and createRequire", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("dynamic", "sequence", "createRequire"),
				fc.constantFrom("", " ", "/**/"),
				async (form, gap) => {
					const entry = form === "createRequire" ? "entry.mjs" : "entry.cjs";
					const source =
						form === "createRequire"
							? 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url); const helper = "./helper.cjs"; export const value = require(helper);'
							: form === "sequence"
								? 'const helper = "./helper.cjs"; module.exports.load = () => import((require(helper), "./safe.js"));'
								: 'const helper = "./helper.cjs"; module.exports = require(helper);';
					await fixture(
						{
							[entry]: source
								.replaceAll("require(", `require${gap}(`)
								.replaceAll("import(", `import${gap}(`),
							"helper.cjs":
								'module.exports = require("./author-style-mark.es.js");',
							"author-style-mark.es.js":
								"exports.igniteAuthorStyle = css => ({ css });",
							"safe.js": "export const safe = true;",
						},
						async (dir) => {
							await expect(esbuildBuild(dir, entry)).rejects.toThrow(
								/cannot mark CSS/,
							);
							await expect(viteBuild(dir, entry)).rejects.toThrow(
								/cannot mark CSS/,
							);
						},
					);
				},
			),
			profile,
		);
	});

	it("R2: stable ordinary functions named require keep their local meaning", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					"function require(value) { return Boolean(value); }",
					"const require = value => Boolean(value);",
					"const require = function(value) { return Boolean(value); };",
				),
				async (declaration) => {
					await fixture(
						{
							"entry.cjs": `${declaration}\nmodule.exports.check = input => require(input);`,
						},
						ordinaryBuild,
					);
				},
			),
			profile,
		);
	});

	it("R3: safe CommonJS wrapper returns remain valid in recursive helper scans", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					"if (true) return;",
					"return void 0;",
					"if (module.exports) return module.exports;",
				),
				async (earlyReturn) => {
					await fixture(
						{
							"entry.cjs":
								'const helper = "./helper.cjs"; module.exports = require(helper);',
							"helper.cjs": `${earlyReturn}\nmodule.exports = require("node:fs");`,
						},
						ordinaryBuild,
					);
				},
			),
			profile,
		);
	});

	it("R4: preceding non-load sequence operands do not become import targets", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(
					fc.constantFrom(
						"0",
						"void 0",
						'console.log("loading")',
						"Math.max(1, 2)",
					),
					{ minLength: 1, maxLength: 3 },
				),
				async (prefixes) => {
					await fixture(
						{
							"entry.cjs": `module.exports.load = () => import((${prefixes.join(", ")}, "./safe.js"));`,
							"safe.js": "export const safe = true;",
						},
						ordinaryBuild,
					);
				},
			),
			profile,
		);
	});

	it("R5: webpack and Rspack honor actual path-qualified Babel-loader matches", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("src/card.js", "src/nested/view.js"),
				fc.boolean(),
				async (entry, nested) => {
					await fixture(
						{
							[entry]: `export const view = <style>{${JSON.stringify(CSS)}}</style>;`,
						},
						async (dir) => {
							const require = createRequire(import.meta.url);
							const loader = path.join(dir, "babel-loader.cjs");
							writeFileSync(
								loader,
								`const babel = require(${JSON.stringify(require.resolve("@babel/core"))}); const preset = require(${JSON.stringify(require.resolve("@babel/preset-react"))}); module.exports = function(source) { return babel.transformSync(source, { filename: this.resourcePath, babelrc: false, configFile: false, presets: [[preset, { runtime: "automatic", importSource: "ignite-element/jsx" }]] }).code; };`,
							);
							const runtime = path.join(dir, "runtime.js");
							writeFileSync(
								runtime,
								"export function jsx() { return null; } export const jsxs = jsx; export const jsxDEV = jsx; export const Fragment = Symbol();",
							);
							const rule = {
								test: /\/src\/.*\.js$/,
								include: path.join(dir, "src"),
								use: [{ loader }],
							};
							for (const bundler of ["webpack", "rspack"] as const) {
								const config = {
									mode: "development" as const,
									context: dir,
									entry: path.join(dir, entry),
									output: {
										path: path.join(dir, bundler),
										filename: "bundle.js",
									},
									resolve: {
										alias: { "ignite-element/jsx/jsx-runtime": runtime },
									},
									module: {
										rules: nested
											? [
													{
														test: /\.js$/,
														oneOf: [
															{ test: /never-matches/, type: "asset/source" },
															rule,
														],
													},
												]
											: [rule],
									},
								};
								await new Promise<void>((resolve, reject) => {
									const complete = (
										error: Error | null | undefined,
										stats:
											| { hasErrors(): boolean; toString(): string }
											| undefined,
									) => {
										if (error) reject(error);
										else if (stats?.hasErrors())
											reject(new Error(stats.toString()));
										else resolve();
									};
									if (bundler === "webpack")
										webpack(
											{
												...config,
												plugins: [
													igniteWebpack({
														jsxImportSource: "ignite-element/jsx",
													}),
												],
											},
											complete,
										);
									else
										rspack.rspack(
											{
												...config,
												plugins: [
													igniteRspack({
														jsxImportSource: "ignite-element/jsx",
													}),
												],
											},
											complete,
										);
								});
								const output = readFileSync(
									path.join(dir, bundler, "bundle.js"),
									"utf8",
								);
								expect(output).toContain("ignite-element.authorStyle");
								expect(output).toContain("http://127.0.0.1:9/x.png");
							}
						},
					);
				},
			),
			{ ...profile, numRuns: 4 },
		);
	}, 30000);
});
