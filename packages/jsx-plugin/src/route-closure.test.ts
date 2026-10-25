import { execFileSync } from "node:child_process";
import {
	cpSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { JSDOM } from "jsdom";
import { type Plugin, rollup } from "rollup";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import webpack from "webpack";
import igniteEsbuild from "./esbuild.js";
import igniteVite from "./vite.js";
import igniteWebpack from "./webpack.js";

const PAYLOAD = "http://127.0.0.1:9/x.png";
const CSS = `.a{background:url(${PAYLOAD})}`;
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const markDist = fileURLToPath(
	new URL(
		"../../ignite-renderer/dist/jsx/author-style-mark.es.js",
		import.meta.url,
	),
);

function writeTree(dir: string, files: Record<string, string>) {
	for (const [name, text] of Object.entries(files)) {
		const full = path.join(dir, name);
		mkdirSync(path.dirname(full), { recursive: true });
		writeFileSync(full, text);
	}
}

const jsxShim = `export function jsx(type, props) {
  if (type === "style") (globalThis.__igniteStyles ?? (globalThis.__igniteStyles = [])).push(props?.children);
  return { type, props };
}
export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = Symbol.for("ignite.fragment");
`;

function installDom() {
	const dom = new JSDOM("<!doctype html><body></body>");
	const globals = globalThis as typeof globalThis & {
		document: unknown;
		HTMLElement: unknown;
		__igniteStyles?: unknown[];
	};
	globals.document = dom.window.document;
	globals.HTMLElement = dom.window.HTMLElement;
	globals.__igniteStyles = [];
	return globals;
}

function branded(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const symbol = Object.getOwnPropertySymbols(value)[0];
	const text = symbol ? (value as Record<symbol, unknown>)[symbol] : undefined;
	return typeof text === "string" ? text : "";
}

describe("route closure", () => {
	it("P2-4: rollup and node-resolve build installed tarballs and keep author CSS", async () => {
		const pack = mkdtempSync(path.join(tmpdir(), "ignite-rollup-pack-"));
		const app = mkdtempSync(path.join(tmpdir(), "ignite-rollup-app-"));
		try {
			for (const cwd of [
				"packages/ignite-element",
				"packages/ignite-renderer",
				"packages/jsx-plugin",
			]) {
				execFileSync("pnpm", ["pack", "--pack-destination", pack], {
					cwd: path.join(repoRoot, cwd),
					stdio: "pipe",
				});
			}
			const tarballs = readdirSync(pack)
				.filter((name) => name.endsWith(".tgz"))
				.map((name) => path.join(pack, name));
			writeFileSync(
				path.join(app, "package.json"),
				`${JSON.stringify({ name: "rollup-app", private: true, type: "module" })}\n`,
			);
			execFileSync(
				"npm",
				["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs],
				{ cwd: app, stdio: "pipe" },
			);
			const elementDist = path.join(app, "node_modules/ignite-element/dist");
			const strategy = readdirSync(elementDist).find(
				(name) =>
					name.startsWith("IgniteJsxRenderStrategy-") &&
					name.endsWith(".js") &&
					!name.includes("development"),
			);
			if (!strategy)
				throw new Error("installed element dist has no strategy chunk");
			const entry = path.join(app, "entry.tsx");
			writeFileSync(
				entry,
				`import ${JSON.stringify(`./node_modules/ignite-element/dist/${strategy}`)};
const local = ${JSON.stringify(CSS)};
export function view() {
  return <style>{local}</style>;
}
`,
			);
			const rootRequire = createRequire(path.join(repoRoot, "package.json"));
			const nodeResolve = rootRequire("@rollup/plugin-node-resolve")
				.default as () => Plugin;
			const installed = (await import(
				pathToFileURL(
					path.join(
						app,
						"node_modules/@ignite-element/jsx-plugin/dist/rollup.js",
					),
				).href
			)) as { default: () => Plugin };
			const bundle = await rollup({
				input: entry,
				plugins: [
					nodeResolve(),
					installed.default(),
					{
						name: "shim-jsx",
						resolveId(source) {
							if (source === "ignite-element/jsx/jsx-runtime") return "\0shim";
							return null;
						},
						load(id) {
							if (id === "\0shim") return jsxShim;
							return null;
						},
					},
					{
						name: "esbuild-after",
						transform(code, id) {
							if (!id.endsWith(".tsx")) return null;
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
			const generated = await bundle.generate({ format: "es" });
			await bundle.close();
			const code = generated.output
				.map((item) => ("code" in item ? item.code : ""))
				.join("\n");
			expect(code).toContain(PAYLOAD);
			expect(code).toContain('Symbol("ignite-element.authorStyle")');
			const globals = installDom();
			const outfile = path.join(app, "bundle.mjs");
			writeFileSync(outfile, code);
			const loaded = (await import(pathToFileURL(outfile).href)) as {
				view: () => void;
			};
			loaded.view();
			expect(
				(globals.__igniteStyles ?? []).some((child) =>
					branded(child).includes(PAYLOAD),
				),
			).toBe(true);
		} finally {
			rmSync(pack, { recursive: true, force: true });
			rmSync(app, { recursive: true, force: true });
		}
	}, 180000);

	it("rejects an esbuild template import that names the author mark", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-glob-"));
		writeFileSync(
			path.join(dir, "entry.tsx"),
			`const part = "mark";
export const load = () => import(${"`"}${path.dirname(markDist)}/author-style-\${part}.es.js${"`"});
const local = ".safe{color:red}";
export const view = <style>{local}</style>;
`,
		);
		await expect(
			esbuild.build({
				absWorkingDir: dir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [igniteEsbuild()],
			}),
		).rejects.toThrow(/cannot mark CSS/);
		rmSync(dir, { recursive: true, force: true });
	});

	it("does not trust a bare igniteAuthorStyle call on esbuild, vite, or webpack", async () => {
		const source = `const local = ".safe{color:red}";
export function view() {
  return <style>{local}</style>;
}
export function steal() {
  return igniteAuthorStyle(${JSON.stringify(CSS)});
}
`;
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-unique-"));
		writeTree(dir, { "entry.tsx": source, "jsx-runtime.js": jsxShim });
		try {
			const built = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				plugins: [
					{
						name: "shim",
						setup(build) {
							build.onResolve(
								{ filter: /^ignite-element\/jsx\/jsx-runtime$/ },
								() => ({
									path: path.join(dir, "jsx-runtime.js"),
								}),
							);
						},
					},
					igniteEsbuild(),
				],
			});
			const esbuildCode = built.outputFiles.map((file) => file.text).join("\n");
			await expectAuthorCallIsNotMarked(esbuildCode);

			for (const mode of ["production", "development"] as const) {
				const result = await build({
					configFile: false,
					logLevel: "silent",
					mode,
					root: dir,
					plugins: [igniteVite()],
					resolve: {
						alias: {
							"ignite-element/jsx/jsx-runtime": path.join(
								dir,
								"jsx-runtime.js",
							),
							"ignite-element/jsx/jsx-dev-runtime": path.join(
								dir,
								"jsx-runtime.js",
							),
						},
					},
					esbuild: { jsx: "automatic", jsxImportSource: "ignite-element/jsx" },
					build: {
						write: false,
						minify: false,
						lib: {
							entry: path.join(dir, "entry.tsx"),
							formats: ["es"],
							fileName: "entry",
						},
					},
				});
				const chunk = Array.isArray(result) ? result[0] : result;
				if (!chunk || !("output" in chunk))
					throw new Error("vite did not emit");
				const code = chunk.output
					.map((item) => ("code" in item ? item.code : ""))
					.join("\n");
				await expectAuthorCallIsNotMarked(code);
			}

			const webpackCode = await webpackBundle(dir);
			await expectAuthorCallIsNotMarked(webpackCode);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 60000);

	it("does not let a src symlink or a bundler alias mint author trust", async () => {
		expect(realpathSync(markDist)).toMatch(/author-style-mark\.es\.js$/);
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-alias-"));
		const link = path.join(dir, "stolen.js");
		symlinkSync(markDist, link);
		expect(realpathSync(link)).toBe(realpathSync(markDist));
		const entry = `import { igniteAuthorStyle } from "./stolen.js";
export const stolen = igniteAuthorStyle(${JSON.stringify(CSS)});
`;
		writeFileSync(path.join(dir, "entry.tsx"), entry);
		await expect(
			esbuild.build({
				absWorkingDir: dir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				plugins: [igniteEsbuild()],
			}),
		).rejects.toThrow(/cannot mark CSS/);
		await expect(
			build({
				configFile: false,
				logLevel: "silent",
				root: dir,
				plugins: [igniteVite()],
				build: {
					write: false,
					minify: false,
					rollupOptions: { input: path.join(dir, "entry.tsx") },
				},
			}),
		).rejects.toThrow(/cannot mark CSS/);

		const aliasDir = mkdtempSync(path.join(tmpdir(), "ignite-alias-name-"));
		writeFileSync(
			path.join(aliasDir, "entry.tsx"),
			`import { igniteAuthorStyle } from "app-mark";
export const stolen = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
		);
		await expect(
			esbuild.build({
				absWorkingDir: aliasDir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				alias: { "app-mark": markDist },
				plugins: [igniteEsbuild()],
			}),
		).rejects.toThrow(/cannot mark CSS/);
		await expect(
			build({
				configFile: false,
				logLevel: "silent",
				root: aliasDir,
				plugins: [igniteVite()],
				resolve: { alias: { "app-mark": markDist } },
				build: {
					write: false,
					minify: false,
					rollupOptions: { input: path.join(aliasDir, "entry.tsx") },
				},
			}),
		).rejects.toThrow(/cannot mark CSS/);
		await expect(webpackAlias(aliasDir)).rejects.toThrow(/cannot mark CSS/);
		rmSync(dir, { recursive: true, force: true });
		rmSync(aliasDir, { recursive: true, force: true });
	}, 60000);

	it("does not let webpack require.context mint author trust", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-context-"));
		const markDir = path.dirname(markDist);
		writeFileSync(
			path.join(dir, "entry.js"),
			`const ctx = require.context(${JSON.stringify(markDir)}, false, /author-style-mark\\.es\\.js$/);
const key = ctx.keys().find((name) => name.includes("author-style-mark.es.js"));
export const stolen = ctx(key).igniteAuthorStyle(${JSON.stringify(CSS)});
`,
		);
		await expect(webpackAlias(dir, "entry.js")).rejects.toThrow(
			/cannot mark CSS/,
		);
		rmSync(dir, { recursive: true, force: true });
	}, 30000);

	it("resolves the mark from a nested install and does not keep a directory symlink", async () => {
		const config = readFileSync(
			path.join(repoRoot, "packages/ignite-element/vite.config.ts"),
			"utf8",
		);
		expect(config).not.toContain("symlinkSync");
		expect(config).not.toContain("import.meta.resolve");
		expect(config).not.toContain("createRequire");
		expect(config).toContain("#author-style");
		expect(config).not.toContain(
			"../../@ignite-element/renderer/dist/jsx/author-style-mark.es.js",
		);
		const link = path.join(repoRoot, "packages/@ignite-element/renderer");
		let linked = false;
		try {
			linked = lstatSync(link).isSymbolicLink();
		} catch {
			linked = false;
		}
		expect(linked).toBe(false);
		const strategy = readdirSync(
			path.join(repoRoot, "packages/ignite-element/dist"),
		).find(
			(name) =>
				name.startsWith("IgniteJsxRenderStrategy-") &&
				!name.includes("development"),
		);
		expect(strategy).toBeTruthy();
		const chunk = readFileSync(
			path.join(repoRoot, "packages/ignite-element/dist", strategy ?? ""),
			"utf8",
		);
		expect(chunk).toMatch(/from ["']#author-style["']/);
		expect(chunk).not.toContain("import.meta");
		expect(chunk).not.toContain("../../@ignite-element/renderer/");

		const nested = mkdtempSync(path.join(tmpdir(), "ignite-nested-"));
		const elementDest = path.join(nested, "node_modules/ignite-element");
		const rendererDest = path.join(
			elementDest,
			"node_modules/@ignite-element/renderer",
		);
		mkdirSync(rendererDest, { recursive: true });
		cpSync(
			path.join(repoRoot, "packages/ignite-element/package.json"),
			path.join(elementDest, "package.json"),
		);
		cpSync(
			path.join(repoRoot, "packages/ignite-element/dist"),
			path.join(elementDest, "dist"),
			{ recursive: true },
		);
		cpSync(
			path.join(repoRoot, "packages/ignite-renderer/package.json"),
			path.join(rendererDest, "package.json"),
		);
		cpSync(
			path.join(repoRoot, "packages/ignite-renderer/dist"),
			path.join(rendererDest, "dist"),
			{ recursive: true },
		);
		const nestedStrategy = readdirSync(path.join(elementDest, "dist")).find(
			(name) =>
				name.startsWith("IgniteJsxRenderStrategy-") &&
				!name.includes("development"),
		);
		const loaded = (await import(
			pathToFileURL(path.join(elementDest, "dist", nestedStrategy ?? "")).href
		)) as { readAuthorStyle?: unknown };
		expect(loaded.readAuthorStyle).toBeUndefined();
		const nestedRequire = createRequire(path.join(elementDest, "package.json"));
		const entry = realpathSync(
			nestedRequire.resolve("@ignite-element/renderer"),
		);
		expect(entry.startsWith(realpathSync(rendererDest))).toBe(true);
		const rendererMark = realpathSync(
			path.join(path.dirname(entry), "jsx/author-style-mark.es.js"),
		);
		expect(rendererMark.startsWith(realpathSync(rendererDest))).toBe(true);
		expect(() =>
			nestedRequire.resolve("@ignite-element/renderer/jsx/author-style-read"),
		).toThrow(/ERR_PACKAGE_PATH_NOT_EXPORTED|not defined by "exports"/);
		const elementMark = realpathSync(
			path.join(elementDest, "dist/jsx/author-style-mark.es.js"),
		);
		expect(elementMark.startsWith(realpathSync(elementDest))).toBe(true);
		const probe = path.join(elementDest, "dist/author-style-probe.mjs");
		writeFileSync(probe, 'export { readAuthorStyle } from "#author-style";\n');
		const probeMod = (await import(pathToFileURL(probe).href)) as {
			readAuthorStyle: (value: unknown) => string | undefined;
		};
		expect(typeof probeMod.readAuthorStyle).toBe("function");
		const elementMod = (await import(pathToFileURL(elementMark).href)) as {
			readAuthorStyle: (value: unknown) => string | undefined;
		};
		expect(probeMod.readAuthorStyle).toBe(elementMod.readAuthorStyle);
		rmSync(nested, { recursive: true, force: true });
	});
});

async function expectAuthorCallIsNotMarked(code: string) {
	const globals = installDom();
	const file = path.join(
		mkdtempSync(path.join(tmpdir(), "ignite-unique-out-")),
		"bundle.mjs",
	);
	writeFileSync(file, code);
	const loaded = (await import(pathToFileURL(file).href)) as {
		view: () => void;
		steal: () => unknown;
	};
	expect(typeof loaded.view, code.slice(0, 180)).toBe("function");
	loaded.view();
	expect(
		(globals.__igniteStyles ?? []).some((child) =>
			branded(child).includes(PAYLOAD),
		),
	).toBe(false);
	expect(
		(globals.__igniteStyles ?? []).some((child) =>
			branded(child).includes(".safe"),
		),
	).toBe(true);
	expect(() => loaded.steal()).toThrow(ReferenceError);
}

function webpackBundle(dir: string): Promise<string> {
	const out = mkdtempSync(path.join(tmpdir(), "ignite-webpack-out-"));
	const loader = path.join(dir, "jsx.cjs");
	const esbuildPath = createRequire(import.meta.url).resolve("esbuild");
	writeFileSync(
		loader,
		`const esbuild = require(${JSON.stringify(esbuildPath)});
module.exports = function jsx(source) {
  return esbuild.transformSync(source, {
    loader: "tsx",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "ignite-element/jsx",
  }).code;
};
`,
	);
	return new Promise((resolve, reject) => {
		webpack(
			{
				mode: "development",
				context: dir,
				entry: path.join(dir, "entry.tsx"),
				output: {
					path: out,
					filename: "bundle.js",
					module: true,
					library: { type: "module" },
				},
				experiments: { outputModule: true },
				plugins: [igniteWebpack()],
				resolve: {
					extensions: [".tsx", ".ts", ".js"],
					alias: {
						"ignite-element/jsx/jsx-runtime": path.join(dir, "jsx-runtime.js"),
						"ignite-element/jsx/jsx-dev-runtime": path.join(
							dir,
							"jsx-runtime.js",
						),
					},
				},
				module: {
					rules: [{ test: /\.tsx$/, use: [{ loader }] }],
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

function webpackAlias(dir: string, entry = "entry.tsx"): Promise<string> {
	const out = mkdtempSync(path.join(tmpdir(), "ignite-webpack-alias-"));
	const loader = path.join(dir, "jsx.cjs");
	const esbuildPath = createRequire(import.meta.url).resolve("esbuild");
	writeFileSync(
		loader,
		`const esbuild = require(${JSON.stringify(esbuildPath)});
module.exports = function jsx(source) {
  return esbuild.transformSync(source, {
    loader: "tsx",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "ignite-element/jsx",
  }).code;
};
`,
	);
	return new Promise((resolve, reject) => {
		webpack(
			{
				mode: "development",
				context: dir,
				entry: path.join(dir, entry),
				output: { path: out, filename: "bundle.js" },
				plugins: [igniteWebpack()],
				resolve: {
					extensions: [".tsx", ".ts", ".js"],
					alias: { "app-mark": markDist },
				},
				module: {
					rules: [{ test: /\.tsx$/, use: [{ loader }] }],
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
