import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import * as rspack from "@rspack/core";
import esbuild from "esbuild";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import webpack from "webpack";
import igniteEsbuild from "./esbuild.js";
import igniteRspack from "./rspack.js";
import { transformSource } from "./transform.js";
import igniteVite from "./vite.js";
import igniteWebpack from "./webpack.js";

const CSS = ".a{background:url(http://127.0.0.1:9/x.png)}";

function writeMarkApp(entryName: string, entrySource: string) {
	const dir = mkdtempSync(path.join(tmpdir(), "ignite-cjs-mark-"));
	writeFileSync(
		path.join(dir, "author-style-mark.es.js"),
		`exports.igniteAuthorStyle = function igniteAuthorStyle(css) {
			return { css, brand: "ignite-element.authorStyle" };
		};
`,
	);
	writeFileSync(
		path.join(dir, "helper.cjs"),
		`module.exports = require("./author-style-mark.es.js");
`,
	);
	writeFileSync(path.join(dir, entryName), entrySource);
	return dir;
}

const dynamicRequire = `const helper = "./helper.cjs";
const mark = require(helper);
module.exports.view = mark.igniteAuthorStyle(${JSON.stringify(CSS)});
`;

describe("CJS require(helper)", () => {
	it("refuses a .cjs require(helper) under esbuild before Node can load the mark", async () => {
		const dir = writeMarkApp("entry.cjs", dynamicRequire);
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [path.join(dir, "entry.cjs")],
					bundle: true,
					write: false,
					format: "cjs",
					platform: "node",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses a .cjs require(helper) that Vite would leave for Node or SSR", async () => {
		const dir = writeMarkApp("entry.cjs", dynamicRequire);
		try {
			await expect(
				build({
					configFile: false,
					logLevel: "silent",
					root: dir,
					plugins: [igniteVite()],
					build: {
						ssr: path.join(dir, "entry.cjs"),
						write: false,
						minify: false,
					},
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses a .cjs file whose module parse fails and still require()s a helper", async () => {
		const dir = writeMarkApp(
			"entry.cjs",
			`<!--\nwith (Math) {}\ndelete unboundName;\n${dynamicRequire}`,
		);
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [path.join(dir, "entry.cjs")],
					bundle: true,
					write: false,
					format: "cjs",
					platform: "node",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not trust a package.json name outside the resolved ignite roots", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-fake-root-"));
		const fake = path.join(dir, "fake-renderer");
		mkdirSync(fake);
		writeFileSync(
			path.join(fake, "package.json"),
			`${JSON.stringify({ name: "@ignite-element/renderer" })}\n`,
		);
		writeFileSync(
			path.join(fake, "author-style-mark.es.js"),
			"exports.igniteAuthorStyle = function (css) { return { css }; };\n",
		);
		writeFileSync(
			path.join(fake, "helper.cjs"),
			`const helper = "./author-style-mark.es.js";
module.exports = require(helper);
`,
		);
		writeFileSync(
			path.join(dir, "entry.cjs"),
			`module.exports = require("./fake-renderer/helper.cjs");
`,
		);
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [path.join(dir, "entry.cjs")],
					bundle: true,
					write: false,
					format: "cjs",
					platform: "node",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("allows a const string import() that does not reach the mark", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-const-import-"));
		const entry = path.join(dir, "model.ts");
		writeFileSync(
			entry,
			`const specifier = "@anthropic-ai/sdk";
export const load = () => import(specifier);
`,
		);
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				platform: "neutral",
				external: ["@anthropic-ai/sdk"],
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			expect(result.outputFiles.map((file) => file.text).join("\n")).toContain(
				"@anthropic-ai/sdk",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("still refuses require() of a let that names the helper", async () => {
		const dir = writeMarkApp(
			"entry.cjs",
			`let helper = "./helper.cjs";
module.exports = require(helper);
`,
		);
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [path.join(dir, "entry.cjs")],
					bundle: true,
					write: false,
					format: "cjs",
					platform: "node",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("still builds a .cjs file that only requires Node", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-cjs-fs-"));
		const entry = path.join(dir, "entry.cjs");
		writeFileSync(
			entry,
			`const fs = require("node:fs");
module.exports.ok = typeof fs.readFileSync;
`,
		);
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "cjs",
				platform: "node",
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			expect(result.outputFiles.map((file) => file.text).join("\n")).toContain(
				"readFileSync",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("one @jsxImportSource", () => {
	it("refuses a file with more than one @jsxImportSource comment", () => {
		const both = `/** @jsxImportSource ignite-element/jsx */
/** @jsxImportSource react */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(() => transformSource(both, "Card.tsx")).toThrow(/@jsxImportSource/);
		expect(() => transformSource(both, "Card.tsx")).toThrow(
			/cannot|one @jsxImportSource|disagree/,
		);
		const reversed = `/** @jsxImportSource react */
/** @jsxImportSource ignite-element/jsx */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(() => transformSource(reversed, "Card.tsx")).toThrow(
			/@jsxImportSource/,
		);
		const sameComment = `/**
 * @jsxImportSource ignite-element/jsx
 * @jsxImportSource react
 */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(() => transformSource(sameComment, "Card.tsx")).toThrow(
			/@jsxImportSource/,
		);
	});

	it("does not mark a React file", () => {
		const react = `/** @jsxImportSource react */
export const view = <style>{".a{color:red}"}</style>;
`;
		expect(transformSource(react, "Card.tsx")).toBe(react);
		expect(transformSource(react, "Card.tsx")).not.toContain(
			"igniteAuthorStyle",
		);
	});

	it("marks static style text for a single Ignite pragma", () => {
		const ignite = `/** @jsxImportSource ignite-element/jsx */
export const view = <style>{".a{color:red}"}</style>;
`;
		const output = transformSource(ignite, "Card.tsx");
		expect(output).toContain("igniteAuthorStyle");
		expect(output).toContain(".a{color:red}");
	});
});

function babelLoader(dir: string): string {
	const file = path.join(dir, "babel-loader.cjs");
	writeFileSync(
		file,
		`const babel = require(${JSON.stringify(createRequire(import.meta.url).resolve("@babel/core"))});
const preset = require(${JSON.stringify(createRequire(import.meta.url).resolve("@babel/preset-react"))});
module.exports = function igniteBabelLoader(source) {
	const result = babel.transformSync(source, {
		filename: this.resourcePath,
		babelrc: false,
		configFile: false,
		sourceMaps: false,
		ast: false,
		presets: [[preset, { runtime: "automatic", importSource: "ignite-element/jsx" }]],
	});
	return result && result.code ? result.code : source;
};
`,
	);
	return file;
}

function tsLoader(dir: string): string {
	const file = path.join(dir, "ts-loader.cjs");
	const esbuildPath = createRequire(import.meta.url).resolve("esbuild");
	writeFileSync(
		file,
		`const esbuild = require(${JSON.stringify(esbuildPath)});
module.exports = function igniteTsLoader(source) {
	return esbuild.transformSync(source, {
		loader: "ts",
		format: "esm",
		sourcefile: this.resourcePath,
	}).code;
};
`,
	);
	return file;
}

function jsxRuntime(dir: string): string {
	const file = path.join(dir, "jsx-runtime.js");
	writeFileSync(
		file,
		`export function jsx() { return null; }
export function jsxs() { return null; }
export function jsxDEV() { return null; }
export const Fragment = Symbol.for("ignite.fragment");
`,
	);
	return file;
}

function bundlerFiles() {
	const dir = mkdtempSync(path.join(tmpdir(), "ignite-babel-js-"));
	const runtime = jsxRuntime(dir);
	writeFileSync(
		path.join(dir, "entry.js"),
		`const local = ${JSON.stringify(CSS)};
export const view = <style>{local}</style>;
`,
	);
	return { dir, runtime, babel: babelLoader(dir), ts: tsLoader(dir) };
}

function webpackJs(dir: string, runtime: string, babel: string, ts: string) {
	const out = mkdtempSync(path.join(tmpdir(), "ignite-webpack-js-"));
	return new Promise<string>((resolve, reject) => {
		webpack(
			{
				mode: "development",
				context: dir,
				entry: path.join(dir, "entry.js"),
				output: {
					path: out,
					filename: "bundle.js",
					module: true,
					library: { type: "module" },
				},
				experiments: { outputModule: true },
				plugins: [igniteWebpack({ jsxImportSource: "ignite-element/jsx" })],
				resolve: {
					extensions: [".js", ".ts"],
					alias: {
						"ignite-element/jsx/jsx-runtime": runtime,
						"ignite-element/jsx/jsx-dev-runtime": runtime,
					},
				},
				module: {
					rules: [
						{ test: /\.js$/, use: [{ loader: babel }] },
						{ test: /\.ts$/, use: [{ loader: ts }] },
					],
				},
			},
			(error, stats) => {
				if (error) {
					reject(error);
					return;
				}
				if (stats?.hasErrors()) {
					reject(new Error(stats.toString()));
					return;
				}
				resolve(readFileSync(path.join(out, "bundle.js"), "utf8"));
			},
		);
	});
}

function rspackJs(dir: string, runtime: string, babel: string, ts: string) {
	const out = mkdtempSync(path.join(tmpdir(), "ignite-rspack-js-"));
	return new Promise<string>((resolve, reject) => {
		rspack.rspack(
			{
				mode: "development",
				context: dir,
				entry: path.join(dir, "entry.js"),
				output: {
					path: out,
					filename: "bundle.js",
					module: true,
					library: { type: "module" },
				},
				experiments: { outputModule: true },
				plugins: [igniteRspack({ jsxImportSource: "ignite-element/jsx" })],
				resolve: {
					extensions: [".js", ".ts"],
					alias: {
						"ignite-element/jsx/jsx-runtime": runtime,
						"ignite-element/jsx/jsx-dev-runtime": runtime,
					},
				},
				module: {
					rules: [
						{ test: /\.js$/, use: [{ loader: babel }] },
						{ test: /\.ts$/, use: [{ loader: ts }] },
					],
				},
			},
			(error, stats) => {
				if (error) {
					reject(error);
					return;
				}
				if (stats?.hasErrors()) {
					reject(new Error(stats.toString()));
					return;
				}
				resolve(readFileSync(path.join(out, "bundle.js"), "utf8"));
			},
		);
	});
}

describe("JSX in .js with babel-loader", () => {
	it("webpack and rspack mark static style text", async () => {
		const { dir, runtime, babel, ts } = bundlerFiles();
		try {
			const webpackCode = await webpackJs(dir, runtime, babel, ts);
			expect(webpackCode).toContain("ignite-element.authorStyle");
			expect(webpackCode).toContain("http://127.0.0.1:9/x.png");
			const rspackCode = await rspackJs(dir, runtime, babel, ts);
			expect(rspackCode).toContain("ignite-element.authorStyle");
			expect(rspackCode).toContain("http://127.0.0.1:9/x.png");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("keeps angle-bracket assertions in .ts, .mts, and .cts", () => {
		const assertion = "export const value = <number>42;\n";
		for (const filename of ["value.ts", "value.mts", "value.cts"]) {
			expect(transformSource(assertion, filename, { jsxScript: true })).toBe(
				assertion,
			);
		}
	});
});

describe("Codex scan follow-ups", () => {
	it("allows an ordinary dependency dynamic require under esbuild", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-dep-require-"));
		const dep = path.join(dir, "node_modules", "ordinary-dep");
		mkdirSync(dep, { recursive: true });
		writeFileSync(
			path.join(dep, "package.json"),
			`${JSON.stringify({ name: "ordinary-dep", main: "index.cjs" })}\n`,
		);
		writeFileSync(
			path.join(dep, "index.cjs"),
			"module.exports = (name) => require(name);\n",
		);
		const entry = path.join(dir, "entry.cjs");
		writeFileSync(entry, 'module.exports = require("ordinary-dep");\n');
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "cjs",
				platform: "node",
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			expect(result.outputFiles.map((file) => file.text).join("\n")).toContain(
				"require",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("still refuses a dependency require of the author mark", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-dep-mark-"));
		const dep = path.join(dir, "node_modules", "mark-dep");
		mkdirSync(dep, { recursive: true });
		writeFileSync(
			path.join(dep, "package.json"),
			`${JSON.stringify({ name: "mark-dep", main: "index.cjs" })}\n`,
		);
		writeFileSync(
			path.join(dep, "author-style-mark.es.js"),
			"exports.igniteAuthorStyle = function (css) { return { css }; };\n",
		);
		writeFileSync(
			path.join(dep, "index.cjs"),
			`const helper = "./author-style-mark.es.js";
module.exports = require(helper);
`,
		);
		const entry = path.join(dir, "entry.cjs");
		writeFileSync(entry, 'module.exports = require("mark-dep");\n');
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [entry],
					bundle: true,
					write: false,
					format: "cjs",
					platform: "node",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("parses JSX in a dynamically imported .js file when the loader is jsx", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-jsx-scan-"));
		writeFileSync(
			path.join(dir, "view.js"),
			`const loaded = import("node:fs");
export const view = <section>{loaded}</section>;
`,
		);
		const entry = path.join(dir, "entry.js");
		writeFileSync(entry, 'export const loaded = import("./view.js");\n');
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				platform: "neutral",
				loader: { ".js": "jsx" },
				external: ["node:fs"],
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			const text = result.outputFiles.map((file) => file.text).join("\n");
			expect(text).toContain("section");
			expect(text).not.toContain("cannot mark CSS");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("resolves same-named const import targets in different functions", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-lexical-const-"));
		writeFileSync(path.join(dir, "safe.js"), "export const ok = 1;\n");
		writeFileSync(path.join(dir, "also-safe.js"), "export const ok = 2;\n");
		const entry = path.join(dir, "entry.js");
		writeFileSync(
			entry,
			`function loadSafe() {
  const specifier = "./safe.js";
  return import(specifier);
}
function loadOther() {
  const specifier = "./also-safe.js";
  return import(specifier);
}
export const ready = [loadSafe, loadOther];
`,
		);
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				platform: "neutral",
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			});
			const text = result.outputFiles.map((file) => file.text).join("\n");
			expect(text).toContain("./safe.js");
			expect(text).toContain("./also-safe.js");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("still refuses a same-named const that reaches the author mark", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-lexical-mark-"));
		writeFileSync(path.join(dir, "safe.js"), "export const ok = 1;\n");
		writeFileSync(
			path.join(dir, "author-style-mark.es.js"),
			"export function igniteAuthorStyle(css) { return { css }; }\n",
		);
		const entry = path.join(dir, "entry.js");
		writeFileSync(
			entry,
			`function loadSafe() {
  const specifier = "./safe.js";
  return import(specifier);
}
function loadMark() {
  const specifier = "./author-style-mark.es.js";
  return import(specifier);
}
export const ready = [loadSafe, loadMark];
`,
		);
		try {
			await expect(
				esbuild.build({
					absWorkingDir: dir,
					entryPoints: [entry],
					bundle: true,
					write: false,
					format: "esm",
					platform: "neutral",
					plugins: [igniteEsbuild()],
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
