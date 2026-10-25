import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { JSDOM } from "jsdom";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import webpack, { type Configuration } from "webpack";
import igniteEsbuild from "./esbuild.js";
import igniteVite from "./vite.js";

const PAYLOAD = "http://127.0.0.1:9/x.png";
const CSS = `.a{background:url(${PAYLOAD})}`;
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const markDist = fileURLToPath(
	new URL(
		"../../ignite-renderer/dist/jsx/author-style-mark.es.js",
		import.meta.url,
	),
);
const markSource = fileURLToPath(
	new URL(
		"../../ignite-renderer/src/renderers/jsx/authorStyle.ts",
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

async function bundleApp(
	files: Record<string, string>,
	entry = "entry.tsx",
): Promise<string> {
	const dir = mkdtempSync(path.join(tmpdir(), "ignite-route-"));
	writeTree(dir, files);
	try {
		const result = await build({
			configFile: false,
			logLevel: "silent",
			root: dir,
			plugins: [igniteVite()],
			esbuild: { jsx: "automatic", jsxImportSource: "ignite-element/jsx" },
			build: {
				write: false,
				minify: false,
				rollupOptions: { input: path.join(dir, entry) },
			},
		});
		const chunk = Array.isArray(result) ? result[0] : result;
		if (!chunk || !("output" in chunk)) {
			throw new Error("vite build did not emit a bundle");
		}
		return chunk.output
			.map((item) => ("code" in item ? item.code : ""))
			.join("\n");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("P2-1 private author mark", () => {
	it("P2-1: an export-from re-export cannot keep a user url", async () => {
		await expect(
			bundleApp({
				"bridge.js": `export { igniteAuthorStyle } from "ignite-element/jsx/author-style";\n`,
				"entry.tsx": `import { igniteAuthorStyle } from "./bridge.js";
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: dynamic import() cannot keep a user url", async () => {
		await expect(
			bundleApp({
				"entry.tsx": `const mod = await import("ignite-element/jsx/author-style");
export const view = mod.igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: a node_modules package that re-exports the mark cannot keep a user url", async () => {
		await expect(
			bundleApp({
				"node_modules/evil-mark/package.json": `${JSON.stringify({ name: "evil-mark", type: "module" })}\n`,
				"node_modules/evil-mark/index.js": `export { igniteAuthorStyle } from "ignite-element/jsx/author-style";\n`,
				"entry.tsx": `import { igniteAuthorStyle } from "evil-mark";
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: a relative deep path to the mark file cannot keep a user url", async () => {
		await expect(
			bundleApp({
				"entry.tsx": `import { igniteAuthorStyle } from ${JSON.stringify(markDist)};
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: a new app-side route does not resolve to the mark", async () => {
		await expect(
			bundleApp({
				"entry.tsx": `import { igniteAuthorStyle } from ${JSON.stringify(markSource)};
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: export * and require() cannot keep a user url", async () => {
		await expect(
			bundleApp({
				"bridge.js": `export * from "ignite-element/jsx/author-style";\n`,
				"entry.tsx": `import { igniteAuthorStyle } from "./bridge.js";
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
			}),
		).rejects.toThrow(/cannot mark CSS/);
		await expect(
			bundleApp(
				{
					"entry.js": `const { igniteAuthorStyle } = require("ignite-element/jsx/author-style");
exports.view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
				},
				"entry.js",
			),
		).rejects.toThrow(/cannot mark CSS/);
	});

	it("P2-1: an app dist file that the plugin skips cannot keep a user url", async () => {
		await expect(
			bundleApp(
				{
					"dist/entry.js": `import { igniteAuthorStyle } from "ignite-element/jsx/author-style";
export const view = igniteAuthorStyle(${JSON.stringify(CSS)});
`,
				},
				"dist/entry.js",
			),
		).rejects.toThrow(/cannot mark CSS/);
	});
});

describe("P2-2 esbuild real mark", () => {
	it("P2-2: esbuild loads the packed plugin, not a stub of the mark", async () => {
		const pack = mkdtempSync(path.join(tmpdir(), "ignite-pack-"));
		const app = mkdtempSync(path.join(tmpdir(), "ignite-packed-app-"));
		try {
			execFileSync("pnpm", ["pack", "--pack-destination", pack], {
				cwd: path.join(repoRoot, "packages/jsx-plugin"),
				stdio: "pipe",
			});
			execFileSync("pnpm", ["pack", "--pack-destination", pack], {
				cwd: path.join(repoRoot, "packages/ignite-renderer"),
				stdio: "pipe",
			});
			const tarballs = readdirSync(pack).filter((name) =>
				name.endsWith(".tgz"),
			);
			const pluginTgz = tarballs.find((name) => name.includes("jsx-plugin"));
			const rendererTgz = tarballs.find((name) => name.includes("renderer"));
			if (!pluginTgz || !rendererTgz) {
				throw new Error(`packed tarballs missing: ${tarballs.join(", ")}`);
			}
			writeFileSync(
				path.join(app, "package.json"),
				`${JSON.stringify({ name: "packed-app", private: true, type: "module" })}\n`,
			);
			execFileSync(
				"pnpm",
				[
					"add",
					"--ignore-workspace",
					path.join(pack, pluginTgz),
					path.join(pack, rendererTgz),
				],
				{ cwd: app, stdio: "pipe" },
			);
			const entry = path.join(app, "entry.tsx");
			writeFileSync(
				entry,
				`const local = ${JSON.stringify(CSS)};
export const view = <style>{local}</style>;
`,
			);
			const plugin = (await import(
				pathToFileURL(
					path.join(
						app,
						"node_modules/@ignite-element/jsx-plugin/dist/esbuild.js",
					),
				).href
			)) as { default: () => esbuild.Plugin };
			const result = await esbuild.build({
				absWorkingDir: app,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [plugin.default()],
			});
			const code = result.outputFiles.map((file) => file.text).join("\n");
			expect(code).toContain(PAYLOAD);
			expect(code).toContain("ignite-element.authorStyle");
			expect(code).not.toContain("ignite-jsx:");
		} finally {
			rmSync(pack, { recursive: true, force: true });
			rmSync(app, { recursive: true, force: true });
		}
	}, 120_000);

	it("P2-2: esbuild loads the real mark import with namespace file", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-esbuild-"));
		const entry = path.join(dir, "entry.tsx");
		writeFileSync(
			entry,
			`const local = ${JSON.stringify(CSS)};
export const view = <style>{local}</style>;
`,
		);
		try {
			const result = await esbuild.build({
				absWorkingDir: dir,
				entryPoints: [entry],
				bundle: true,
				write: false,
				format: "esm",
				jsx: "automatic",
				jsxImportSource: "ignite-element/jsx",
				external: ["ignite-element/jsx/jsx-runtime"],
				plugins: [igniteEsbuild()],
			});
			const code = result.outputFiles.map((file) => file.text).join("\n");
			expect(code).toContain(PAYLOAD);
			expect(code).toContain("ignite-element.authorStyle");
			expect(code).not.toContain("ignite-jsx:");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("P2-3 dev registry and CJS webpack", () => {
	it("P2-3: the development renderer and the production mark share one registry", async () => {
		const devBundle = fileURLToPath(
			new URL(
				"../../ignite-renderer/dist/jsx.development.es.js",
				import.meta.url,
			),
		);
		expect(readFileSync(devBundle, "utf8")).not.toContain(
			"author-style-mark.development.es.js",
		);
		const dom = new JSDOM("<!doctype html><body></body>");
		const globals = globalThis as typeof globalThis & {
			document: Document;
			HTMLElement: typeof HTMLElement;
			Element: typeof Element;
			Node: typeof Node;
			SVGElement: typeof SVGElement;
		};
		globals.document = dom.window.document;
		globals.HTMLElement = dom.window.HTMLElement;
		globals.Element = dom.window.Element;
		globals.Node = dom.window.Node;
		globals.SVGElement = dom.window.SVGElement;
		const dev = (await import(pathToFileURL(devBundle).href)) as {
			jsx: (type: string, props: Record<string, unknown>) => unknown;
			mountIgniteJsxOnce: (host: HTMLElement, node: unknown) => void;
		};
		const mark = (await import(pathToFileURL(markDist).href)) as {
			igniteAuthorStyle: (css: string) => unknown;
		};
		const host = dom.window.document.createElement("div");
		dev.mountIgniteJsxOnce(
			host,
			dev.jsx("style", { children: mark.igniteAuthorStyle(CSS) }),
		);
		expect(host.querySelector("style")?.textContent ?? "").toContain(PAYLOAD);
	});

	it("P2-3: a CJS webpack config does not throw on import.meta.url", async () => {
		const require = createRequire(import.meta.url);
		const igniteWebpack = require("../dist/webpack.cjs") as () => object;
		const dir = mkdtempSync(path.join(tmpdir(), "ignite-cjs-webpack-"));
		const out = path.join(dir, "out");
		mkdirSync(out, { recursive: true });
		const entry = path.join(dir, "entry.tsx");
		writeFileSync(
			entry,
			`const local = ${JSON.stringify(CSS)};
export const view = <style>{local}</style>;
`,
		);
		const jsxLoader = path.join(dir, "jsx.cjs");
		const esbuildPath = require.resolve("esbuild");
		writeFileSync(
			jsxLoader,
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
		const compiler = webpack({
			mode: "development",
			context: dir,
			entry,
			output: { path: out, filename: "bundle.js", module: true },
			experiments: { outputModule: true },
			plugins: [
				igniteWebpack() as NonNullable<Configuration["plugins"]>[number],
			],
			externals: [/^ignite-element\/jsx\/jsx-runtime$/],
			resolve: { extensions: [".tsx", ".ts", ".js"] },
			module: {
				rules: [{ test: /\.tsx$/, use: [{ loader: jsxLoader }] }],
			},
		});
		let failure = "";
		const code = await new Promise<string>((resolve) => {
			compiler.run((error, stats) => {
				if (error) {
					failure = error.message;
					resolve("");
					return;
				}
				if (stats?.hasErrors()) {
					failure =
						stats
							.toJson()
							.errors?.map((item) => item.message)
							.join("\n") ?? "";
					resolve("");
					return;
				}
				resolve(readFileSync(path.join(out, "bundle.js"), "utf8"));
			});
		});
		expect(failure, failure).toBe("");
		expect(code).toContain(PAYLOAD);
		expect(code).toContain("ignite-element.authorStyle");
		expect(code).not.toContain("ignite-element/jsx/author-style");
		rmSync(dir, { recursive: true, force: true });
	}, 20000);
});

describe("P3 readAuthorStyle", () => {
	it("P3: readAuthorStyle is not a public export", async () => {
		let ownsReader = false;
		try {
			const seam = (await import(
				pathToFileURL(
					fileURLToPath(
						new URL(
							"../../ignite-renderer/dist/jsx/author-style.es.js",
							import.meta.url,
						),
					),
				).href
			)) as Record<string, unknown>;
			ownsReader = Object.hasOwn(seam, "readAuthorStyle");
		} catch {
			ownsReader = false;
		}
		expect(ownsReader).toBe(false);
		const manifest = JSON.parse(
			readFileSync(
				path.join(repoRoot, "packages/ignite-renderer/package.json"),
				"utf8",
			),
		) as { exports?: Record<string, unknown> };
		expect(manifest.exports?.["./jsx/author-style"]).toBeUndefined();
	});
});
