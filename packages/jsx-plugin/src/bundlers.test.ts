import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "@babel/core";
import * as rspack from "@rspack/core";
import esbuild from "esbuild";
import { JSDOM } from "jsdom";
import { rolldown } from "rolldown";
import { rollup } from "rollup";
import ts from "typescript";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import webpack from "webpack";
import igniteJsxBabel from "./babel.js";
import igniteEsbuild from "./esbuild.js";
import igniteRolldown from "./rolldown.js";
import igniteRollup from "./rollup.js";
import igniteRspack from "./rspack.js";
import igniteJsxTypeScript from "./typescript.js";
import { resolveAuthorMark } from "./unplugin.js";
import igniteVite from "./vite.js";
import igniteWebpack from "./webpack.js";

const fixtureDir = fileURLToPath(new URL("../fixtures/", import.meta.url));
const fixture = path.join(fixtureDir, "Card.tsx");
const source = readFileSync(fixture, "utf8");

function markerName(code: string): string {
	const alias = code.match(/igniteAuthorStyle as ([A-Za-z0-9_$]+)/);
	if (alias?.[1]) return alias[1];
	if (
		/[.)]igniteAuthorStyle\)?\(/.test(code) ||
		/\bigniteAuthorStyle\(/.test(code)
	) {
		return "igniteAuthorStyle";
	}
	const helper = code.match(
		/function (\w+)\([^)]*\)\s*\{[\s\S]{0,200}?igniteAuthorStyle expects a string/,
	);
	return helper?.[1] ?? "igniteAuthorStyle";
}

function assertMarked(code: string, bundler: string) {
	const name = markerName(code).replace(/\$/g, "\\$");
	const calls = code.match(new RegExp(`\\b${name}\\)?\\(`, "g")) ?? [];
	expect(calls.length, `${bundler} via ${name}`).toBeGreaterThanOrEqual(4);
	expect(
		code.includes("ignite-jsx:author-style") ||
			code.includes('Symbol("ignite-element.authorStyle")') ||
			code.includes("author-style-mark"),
		bundler,
	).toBe(true);
	expect(code, bundler).not.toContain("ignite-element/jsx/author-style");
	expect(code, bundler).toContain("cdn.example/static.png");
	expect(code, bundler).toContain("cardCss");
	expect(code, bundler).not.toMatch(
		new RegExp(`\\b${name}\\)?\\(\\s*\`[^\`]*\\$\\{props\\.image\\}`),
	);
	expect(code, bundler).not.toMatch(
		new RegExp(`\\b${name}\\)?\\(\\s*props\\.cardCss\\s*\\)`),
	);
	expect(code, bundler).toContain("props.image");
	for (const binding of [
		"live",
		"old",
		"assigned",
		"sum",
		"moduleSheet",
		"alias",
	]) {
		expect(code, bundler).not.toMatch(
			new RegExp(`\\b${name}\\)?\\(\\s*${binding}\\s*\\)`),
		);
	}
}

function tempDir() {
	return mkdtempSync(path.join(tmpdir(), "ignite-jsx-"));
}

describe("bundler fixtures", () => {
	it("every bundler build marks the fixture the same way", async () => {
		const viteOut = await build({
			configFile: false,
			logLevel: "silent",
			plugins: [igniteVite()],
			esbuild: {
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
			},
			build: {
				write: false,
				minify: false,
				lib: { entry: fixture, formats: ["es"], fileName: "card" },
				rollupOptions: {
					external: [/^ignite-element\//],
				},
			},
		});
		const viteChunk = Array.isArray(viteOut) ? viteOut[0] : viteOut;
		if (!viteChunk || !("output" in viteChunk)) {
			throw new Error("vite build did not emit a bundle");
		}
		const viteCode = viteChunk.output
			.map((item) => ("code" in item ? item.code : ""))
			.join("\n");
		assertMarked(viteCode, "vite");

		const rollupBundle = await rollup({
			input: fixture,
			external: [/^ignite-element\//],
			plugins: [
				igniteRollup(),
				{
					name: "esbuild-after",
					transform(code, id) {
						if (!id.endsWith(".tsx") && !id.endsWith(".ts")) return null;
						const result = esbuild.transformSync(code, {
							loader: "tsx",
							jsx: "automatic",
							jsxImportSource: "ignite-element/jsx",
							format: "esm",
						});
						return { code: result.code, map: null };
					},
				},
			],
		});
		const rollupOut = await rollupBundle.generate({ format: "es" });
		assertMarked(
			rollupOut.output
				.map((item) => ("code" in item ? item.code : ""))
				.join("\n"),
			"rollup",
		);
		await rollupBundle.close();

		const esbuildOut = await esbuild.build({
			absWorkingDir: fixtureDir,
			entryPoints: [fixture],
			bundle: true,
			write: false,
			format: "esm",
			jsx: "preserve",
			packages: "external",
			plugins: [igniteEsbuild()],
		});
		const esbuildCode = esbuildOut.outputFiles
			.map((file) => file.text)
			.join("\n");
		assertMarked(esbuildCode, "esbuild");
		await executeEsbuildFixture();

		const rolldownBundle = await rolldown({
			input: fixture,
			external: [/^ignite-element\//],
			plugins: [
				igniteRolldown(),
				{
					name: "esbuild-after",
					transform(code, id) {
						if (!id.endsWith(".tsx") && !id.endsWith(".ts")) return null;
						const result = esbuild.transformSync(code, {
							loader: "tsx",
							jsx: "automatic",
							jsxImportSource: "ignite-element/jsx",
							format: "esm",
						});
						return { code: result.code, map: null };
					},
				},
			],
		});
		const rolldownOut = await rolldownBundle.generate({ format: "es" });
		assertMarked(
			rolldownOut.output
				.map((item) => ("code" in item ? item.code : ""))
				.join("\n"),
			"rolldown",
		);
		await rolldownBundle.close();

		assertMarked(await webpackBuild(), "webpack");
		assertMarked(await rspackBuild(), "rspack");

		const babel = transformSync(source, {
			filename: fixture,
			babelrc: false,
			configFile: false,
			parserOpts: { plugins: ["typescript", "jsx"] },
			plugins: [igniteJsxBabel],
		});
		assertMarked(babel?.code ?? "", "babel");

		const printed = ts.transpileModule(source, {
			fileName: fixture,
			compilerOptions: {
				jsx: ts.JsxEmit.Preserve,
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
			},
			transformers: { before: [igniteJsxTypeScript()] },
		});
		assertMarked(printed.outputText, "typescript");
	}, 120000);

	it("resolves the compiler mark from an example file", () => {
		const entry = fileURLToPath(
			new URL(
				"../../../examples/agents/voice-workbench/src/parity.tsx",
				import.meta.url,
			),
		);
		expect(resolveAuthorMark(entry)).toMatch(
			/packages\/ignite-renderer\/src\/renderers\/jsx\/authorStyle\.ts$/,
		);
		const dashboard = fileURLToPath(
			new URL(
				"../../../examples/apps/dashboard-with-shared-state/src/dashboard.tsx",
				import.meta.url,
			),
		);
		expect(resolveAuthorMark(dashboard)).toBe(resolveAuthorMark(entry));
	});

	it("resolves the compiler mark from a docs-site file", async () => {
		const docs = fileURLToPath(new URL("../../../docs/site/", import.meta.url));
		const dir = mkdtempSync(path.join(docs, ".mark-resolve-"));
		const entry = path.join(dir, "entry.tsx");
		writeFileSync(
			entry,
			`const local = ".a{background:url(https://cdn.example/static.png)}";
export const view = <style>{local}</style>;
`,
		);
		try {
			expect(resolveAuthorMark(entry)).toMatch(
				/dist\/jsx\/author-style-mark\.es\.js$/,
			);
			const result = await build({
				configFile: false,
				logLevel: "silent",
				plugins: [igniteVite()],
				root: docs,
				esbuild: {
					jsx: "automatic",
					jsxImportSource: "ignite-element/jsx",
				},
				build: {
					write: false,
					minify: false,
					lib: { entry, formats: ["es"], fileName: "entry" },
					rollupOptions: {
						external: [
							/^ignite-element\/(?!jsx\/author-style$)/,
							/^@ignite-element\//,
						],
					},
				},
			});
			const chunk = Array.isArray(result) ? result[0] : result;
			if (!chunk || !("output" in chunk)) {
				throw new Error("docs vite build did not emit a bundle");
			}
			const code = chunk.output
				.map((item) => ("code" in item ? item.code : ""))
				.join("\n");
			expect(code).toContain("https://cdn.example/static.png");
			expect(code).toContain('Symbol("ignite-element.authorStyle")');
			expect(code).not.toContain('from "ignite-element/jsx/author-style"');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

async function executeEsbuildFixture() {
	const dom = new JSDOM("<!doctype html><body></body>");
	const globals = globalThis as typeof globalThis & {
		document: unknown;
		HTMLElement: unknown;
	};
	globals.document = dom.window.document;
	globals.HTMLElement = dom.window.HTMLElement;
	const dir = tempDir();
	const outfile = path.join(dir, "card.js");
	const shims = path.join(dir, ".ignite-jsx-shims");
	mkdirSync(shims);
	const jsxShim = path.join(shims, "jsx-runtime.js");
	writeFileSync(
		jsxShim,
		`export function jsx(type, props) {
  if (type === "style") (globalThis.__igniteStyles ?? (globalThis.__igniteStyles = [])).push(props?.children);
  return { type, props };
}
export const jsxs = jsx;
export const Fragment = Symbol.for("ignite.fragment");
`,
	);
	try {
		await esbuild.build({
			absWorkingDir: fixtureDir,
			entryPoints: [fixture],
			bundle: true,
			outfile,
			format: "esm",
			jsx: "automatic",
			jsxImportSource: "ignite-element/jsx",
			plugins: [
				{
					name: "ignite-shims",
					setup(build) {
						build.onResolve(
							{ filter: /^ignite-element\/jsx\/jsx-runtime$/ },
							() => ({
								path: jsxShim,
							}),
						);
						build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
							path: jsxShim,
						}));
					},
				},
				igniteEsbuild(),
			],
		});
		const bag = globalThis as typeof globalThis & {
			__igniteStyles: unknown[];
		};
		bag.__igniteStyles = [];
		const loaded = (await import(pathToFileURL(outfile).href)) as {
			Card: (props: { image: string; cardCss: string }) => void;
		};
		loaded.Card({
			image: "https://evil.example/photo.png",
			cardCss: "url(https://evil.example/spread.png)",
		});
		const styles = bag.__igniteStyles;
		const markedCss = styles.map((child) => {
			if (!child || typeof child !== "object") return "";
			const symbol = Object.getOwnPropertySymbols(child)[0];
			const value = symbol
				? (child as Record<symbol, unknown>)[symbol]
				: undefined;
			return typeof value === "string" ? value : "";
		});
		expect(
			markedCss.some((css) => css.includes("cdn.example/static.png")),
		).toBe(true);
		expect(markedCss.some((css) => css.includes("cdn.example/card.png"))).toBe(
			true,
		);
		expect(markedCss.some((css) => css.includes("evil.example"))).toBe(false);
		expect(
			styles.some(
				(child) => typeof child === "string" && child.includes("evil.example"),
			),
		).toBe(true);
	} finally {
		rmSync(dir, { force: true, recursive: true });
	}
}

function webpackBuild(): Promise<string> {
	const out = tempDir();
	return new Promise((resolve, reject) => {
		webpack(
			{
				mode: "development",
				entry: fixture,
				output: { path: out, filename: "bundle.js" },
				plugins: [igniteWebpack()],
				resolve: { extensions: [".tsx", ".ts", ".js"] },
				module: {
					rules: [
						{
							test: /\.tsx$/,
							use: [
								{
									loader: path.join(fixtureDir, "capture-loader.cjs"),
								},
							],
						},
					],
				},
			},
			(error, stats) => {
				if (error) {
					rmSync(out, { force: true, recursive: true });
					reject(error);
					return;
				}
				if (stats?.hasErrors()) {
					const details = stats
						.toJson()
						.errors?.map((item) => item.message)
						.join("\n");
					rmSync(out, { force: true, recursive: true });
					reject(new Error(details));
					return;
				}
				const code = readFileSync(path.join(out, "transformed.js"), "utf8");
				rmSync(out, { force: true, recursive: true });
				resolve(code);
			},
		);
	});
}

function rspackBuild(): Promise<string> {
	const out = tempDir();
	return new Promise((resolve, reject) => {
		rspack.rspack(
			{
				mode: "development",
				entry: fixture,
				output: { path: out, filename: "bundle.js" },
				plugins: [igniteRspack()],
				externals: [
					({ request }: { request?: string }) =>
						request?.startsWith("ignite-element/") ? request : undefined,
				],
				resolve: { extensions: [".tsx", ".ts", ".js"] },
				module: {
					rules: [
						{
							test: /\.tsx$/,
							loader: "builtin:swc-loader",
							options: {
								jsc: {
									parser: { syntax: "typescript", tsx: true },
									transform: {
										react: {
											runtime: "automatic",
											importSource: "ignite-element/jsx",
										},
									},
								},
							},
							type: "javascript/auto",
						},
					],
				},
			},
			(error, stats) => {
				if (error) {
					rmSync(out, { force: true, recursive: true });
					reject(error);
					return;
				}
				if (stats?.hasErrors()) {
					rmSync(out, { force: true, recursive: true });
					reject(new Error(stats.toString()));
					return;
				}
				const code = readFileSync(path.join(out, "bundle.js"), "utf8");
				rmSync(out, { force: true, recursive: true });
				resolve(code);
			},
		);
	});
}
