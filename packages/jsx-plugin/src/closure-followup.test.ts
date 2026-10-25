import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
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
const markDir = path.dirname(markDist);

describe("resolved mark routes", () => {
	it("P2-1b: esbuild rejects a template whose resolved files include the mark", async () => {
		const sources = [
			`const a = "x";
export const load = import(${"`"}${markDir}/\${a}.es.js${"`"});
export const view = <style>{${JSON.stringify(CSS)}}</style>;
`,
			`const x = "x";
export const load = require(${"`"}${markDir}/author-\${"style"}-\${x}.es.js${"`"});
export const view = <style>{${JSON.stringify(CSS)}}</style>;
`,
			`const a = "-style-mark";
export const load = import(${"`"}${markDir}/author\${a}.es.js${"`"});
export const view = <style>{${JSON.stringify(CSS)}}</style>;
`,
		];
		for (const source of sources) {
			expect(source).not.toContain("author-style");
			const dir = mkdtempSync(path.join(tmpdir(), "ignite-resolved-glob-"));
			writeFileSync(path.join(dir, "entry.tsx"), source);
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
					logLevel: "silent",
				}),
			).rejects.toThrow(/cannot mark CSS/);
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("P2-1c: esbuild refuses an alias to the mark in a file that has a static style", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-issued-alias-"));
		writeFileSync(
			path.join(dir, "entry.tsx"),
			`import { igniteAuthorStyle } from "app-mark";
const local = ".safe{color:red}";
export const view = <style>{local}</style>;
export const stolen = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
		);
		await expect(
			esbuild.build({
				absWorkingDir: dir,
				entryPoints: ["entry.tsx"],
				bundle: true,
				write: false,
				format: "esm",
				alias: { "app-mark": markDist },
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [igniteEsbuild()],
				logLevel: "silent",
			}),
		).rejects.toThrow(/cannot mark CSS/);
		rmSync(dir, { recursive: true, force: true });
	});

	it("esbuild metafile rejects a variable directory and a string concat import of the mark", async () => {
		const rendererRoot = path.resolve(markDir, "../..");
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-metafile-"));
		const sources = [
			`const a = "jsx/" + "author-" + "style-mark";
export const load = import(${JSON.stringify(`${rendererRoot}/dist/`)} + a + ".es.js");
export const view = <style>{${JSON.stringify(CSS)}}</style>;
`,
			`const a = "jsx/" + "author-" + "style-mark";
export const load = import(\`${rendererRoot}/dist/\${a}.es.js\`);
export const view = <style>{${JSON.stringify(CSS)}}</style>;
`,
		];
		try {
			for (const source of sources) {
				expect(source).not.toContain("author-style");
				writeFileSync(path.join(dir, "entry.tsx"), source);
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
						logLevel: "silent",
					}),
				).rejects.toThrow(/cannot mark CSS/);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("a fake package.json named @ignite-element/renderer cannot mint trust", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-fake-pkg-"));
		const relative = path.relative(dir, markDist).split("\\").join("/");
		const specifier = relative.startsWith(".") ? relative : `./${relative}`;
		writeFileSync(
			path.join(dir, "package.json"),
			`${JSON.stringify({ name: "@ignite-element/renderer" })}\n`,
		);
		writeFileSync(
			path.join(dir, "entry.tsx"),
			`import { igniteAuthorStyle } from ${JSON.stringify(specifier)};
export const stolen = igniteAuthorStyle(${JSON.stringify(CSS)});
export const view = <style>{stolen}</style>;
`,
		);
		writeFileSync(
			path.join(dir, "jsx-runtime.js"),
			"export const jsx = (type, props) => ({ type, props });\nexport const jsxs = jsx;\nexport const jsxDEV = jsx;\n",
		);
		const esbuildPath = createRequire(import.meta.url).resolve("esbuild");
		const loader = path.join(dir, "jsx.cjs");
		writeFileSync(
			loader,
			`const esbuild = require(${JSON.stringify(esbuildPath)});
module.exports = function jsx(source) {
  return esbuild.transformSync(source, {
    loader: "tsx",
    jsx: "automatic",
    jsxImportSource: "ignite-element/jsx",
  }).code;
};
`,
		);
		try {
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
					logLevel: "silent",
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
			await expect(
				new Promise((resolve, reject) => {
					webpack(
						{
							mode: "development",
							context: dir,
							entry: path.join(dir, "entry.tsx"),
							plugins: [igniteWebpack()],
							resolve: { extensions: [".tsx", ".ts", ".js"] },
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
							resolve(stats);
						},
					);
				}),
			).rejects.toThrow(/cannot mark CSS/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("an app import of @ignite-element/renderer/jsx/author-style-read fails", () => {
		const require = createRequire(
			path.join(repoRoot, "packages/ignite-element/package.json"),
		);
		expect(() =>
			require.resolve("@ignite-element/renderer/jsx/author-style-read"),
		).toThrow(/ERR_PACKAGE_PATH_NOT_EXPORTED|not defined by "exports"/);
	});

	it("P2-6: the shipped reader is a static private import with no resolver", () => {
		const config = readFileSync(
			path.join(repoRoot, "packages/ignite-element/vite.config.ts"),
			"utf8",
		);
		expect(config).not.toContain("import.meta.resolve");
		expect(config).not.toContain("await import");
		expect(config).not.toContain("createRequire");
		expect(config).not.toContain(
			"../../@ignite-element/renderer/dist/jsx/author-style-mark.es.js",
		);
		expect(config).toContain("#author-style");
		const elementPkg = JSON.parse(
			readFileSync(
				path.join(repoRoot, "packages/ignite-element/package.json"),
				"utf8",
			),
		) as {
			exports?: Record<string, unknown>;
			imports?: Record<string, unknown>;
		};
		expect(elementPkg.exports?.["./jsx/author-style"]).toBeUndefined();
		expect(elementPkg.exports?.["./jsx/author-style-mark"]).toBeUndefined();
		expect(elementPkg.imports?.["#author-style"]).toBe(
			"./dist/jsx/author-style-mark.es.js",
		);
		const rendererPkg = JSON.parse(
			readFileSync(
				path.join(repoRoot, "packages/ignite-renderer/package.json"),
				"utf8",
			),
		) as { exports?: Record<string, unknown> };
		expect(rendererPkg.exports?.["./jsx/author-style"]).toBeUndefined();
		expect(rendererPkg.exports?.["./jsx/author-style-mark"]).toBeUndefined();
		expect(rendererPkg.exports?.["./jsx/author-style-read"]).toBeUndefined();
		const privateMark = path.join(
			repoRoot,
			"packages/ignite-element/dist/jsx/author-style-mark.es.js",
		);
		if (existsSync(privateMark)) {
			const seam = readFileSync(privateMark, "utf8");
			expect(seam).not.toContain("import.meta");
			expect(seam).not.toContain("createRequire");
		}
	});
});

describe("no-plugin browser builds", () => {
	it("vite and esbuild drop a style load in the browser", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-no-plugin-"));
		const strategyEntry = path.join(
			repoRoot,
			"packages/ignite-element/dist/renderers/ignite-jsx.es.js",
		);
		const stub = path.join(dir, "renderer-stub.js");
		writeFileSync(stub, "export function registerRenderStrategy() {}\n");
		const entry = path.join(dir, "entry.js");
		writeFileSync(
			entry,
			`import { createIgniteJsxRenderStrategy } from ${JSON.stringify(strategyEntry)};
const payload = ${JSON.stringify(PAYLOAD)};
const css = ".a{background:url(" + payload + ")}";
const host = document.createElement("div");
const shadow = host.attachShadow({ mode: "open" });
document.body.append(host);
try {
  const strategy = createIgniteJsxRenderStrategy();
  strategy.attach(shadow);
  strategy.render({ type: "style", props: { children: css } });
  const html = shadow.innerHTML;
  document.body.dataset.result = html.includes(payload) ? "kept" : "dropped";
  document.body.dataset.html = html;
} catch (error) {
  document.body.dataset.result = "error";
  document.body.dataset.html = String(error);
}
`,
		);
		const html = path.join(dir, "index.html");
		writeFileSync(
			html,
			`<!doctype html><body><script type="module" src="./bundle.js"></script></body>`,
		);
		try {
			const esbuildResult = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				platform: "browser",
				logLevel: "silent",
				alias: { "@ignite-element/renderer": stub },
			});
			const esbuildCode = esbuildResult.outputFiles
				.map((file) => file.text)
				.join("\n");
			expect(esbuildCode).not.toContain("import.meta");
			expect(esbuildCode).not.toContain("createRequire");

			const viteResult = await build({
				configFile: false,
				logLevel: "silent",
				root: dir,
				resolve: {
					alias: [
						{
							find: /^@ignite-element\/renderer$/,
							replacement: stub,
						},
					],
				},
				build: {
					write: false,
					minify: false,
					rollupOptions: { input: entry },
				},
			});
			const viteChunk = Array.isArray(viteResult) ? viteResult[0] : viteResult;
			if (!viteChunk || !("output" in viteChunk)) {
				throw new Error("vite did not emit");
			}
			const viteCode = viteChunk.output
				.map((item) => ("code" in item ? item.code : ""))
				.join("\n");
			expect(viteCode).not.toContain("import.meta");
			expect(viteCode).not.toContain("createRequire");

			writeFileSync(path.join(dir, "bundle.js"), esbuildCode);
			const server = createServer((req, res) => {
				const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
				const file =
					pathname === "/bundle.js"
						? path.join(dir, "bundle.js")
						: path.join(dir, "index.html");
				res.setHeader(
					"content-type",
					pathname === "/bundle.js"
						? "text/javascript; charset=utf-8"
						: "text/html; charset=utf-8",
				);
				res.end(readFileSync(file));
			});
			await new Promise<void>((resolve) => {
				server.listen(0, "127.0.0.1", resolve);
			});
			const address = server.address() as AddressInfo;
			const pageUrl = `http://127.0.0.1:${address.port}/`;
			const require = createRequire(
				path.join(repoRoot, "packages/ignite-element/package.json"),
			);
			const { chromium } = require("playwright-core") as {
				chromium: {
					launch: (options: { headless: boolean; args: string[] }) => Promise<{
						newPage: () => Promise<{
							goto: (
								url: string,
								options?: { waitUntil?: "load" },
							) => Promise<unknown>;
							on: (
								event: "pageerror" | "console",
								handler: (value: {
									type?: () => string;
									text?: () => string;
								}) => void,
							) => void;
							evaluate: (
								fn: () => { result?: string; html?: string },
							) => Promise<{ result?: string; html?: string }>;
						}>;
						close: () => Promise<void>;
					}>;
				};
			};
			const browser = await chromium.launch({
				headless: true,
				args: ["--no-sandbox", "--disable-dev-shm-usage"],
			});
			try {
				const page = await browser.newPage();
				const errors: string[] = [];
				page.on("pageerror", (error) => {
					errors.push(String(error));
				});
				page.on("console", (message) => {
					if (message.type?.() === "error") errors.push(message.text?.() ?? "");
				});
				const readResult = async () => {
					errors.length = 0;
					await page.goto(pageUrl, { waitUntil: "load" });
					const body = await page.evaluate(() => {
						const documentBody = (
							globalThis as {
								document?: {
									body?: { dataset?: { result?: string; html?: string } };
								};
							}
						).document?.body;
						return {
							result: documentBody?.dataset?.result,
							html: documentBody?.dataset?.html,
						};
					});
					return { ...body, errors: errors.join("\n") };
				};
				const esbuildPage = await readResult();
				expect(esbuildPage.result, esbuildPage.errors || esbuildPage.html).toBe(
					"dropped",
				);
				expect(esbuildPage.html).not.toContain(PAYLOAD);
				writeFileSync(path.join(dir, "bundle.js"), viteCode);
				const vitePage = await readResult();
				expect(vitePage.result, vitePage.errors || vitePage.html).toBe(
					"dropped",
				);
				expect(vitePage.html).not.toContain(PAYLOAD);
			} finally {
				await browser.close();
				await new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				});
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 60000);
});
