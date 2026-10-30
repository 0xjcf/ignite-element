import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { resolveAuthorRequest } from "./unplugin.js";

const renderer = path.resolve(
	path.dirname(
		createRequire(import.meta.url).resolve("@ignite-element/renderer"),
	),
	"..",
);
const source = path.join(renderer, "src/renderers/jsx");
const mark = path.join(source, "authorStyle.ts");
const properties = { seed: 1801029, numRuns: 60 };

// pnpm's test shim exposes hoisted packages through NODE_PATH. Native child
// fixtures clear it so undeclared owner dependencies cannot hide behind the shim.

describe("workspace renderer provenance", () => {
	it("resolves the renderer from the plugin's own package in native Node", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "ignite-plugin-owner-"));
		try {
			const script = path.join(directory, "probe.mjs");
			writeFileSync(
				script,
				`import assert from "node:assert/strict"; import {createRequire} from "node:module";
const require = createRequire(${JSON.stringify(fileURLToPath(new URL("./unplugin.ts", import.meta.url)))});
assert.equal(require.resolve("@ignite-element/renderer"), ${JSON.stringify(path.join(renderer, "dist/ignite-renderer.es.js"))});`,
			);
			execFileSync(process.execPath, [script], {
				env: { ...process.env, NODE_PATH: "" },
				stdio: "pipe",
				timeout: 30000,
			});
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("recognizes the actual renderer's own author-style imports", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					"renderer.ts",
					"xssGuard.ts",
					"IgniteJsxRenderStrategy.ts",
				),
				fc.constantFrom("./authorStyle", "./authorStyle.ts", mark),
				fc.constantFrom("", "?import", "?v=source"),
				(importer, request, query) => {
					expect(
						resolveAuthorRequest(request + query, path.join(source, importer)),
					).toBeNull();
				},
			),
			properties,
		);
	});

	it("never grants application files ownership from a package name or lookalike path", () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "ignite-provenance-app-"),
		);
		try {
			fc.assert(
				fc.property(
					fc.constantFrom(
						"src",
						"packages/ignite-renderer/src/renderers/jsx",
						"dist",
						"node_modules/@ignite-element/renderer/dist",
					),
					fc.constantFrom("@ignite-element/renderer", "ignite-element"),
					fc.constantFrom("", "?import"),
					fc.constantFrom(mark, "/virtual/author-style-resolve.js"),
					(layout, name, query, request) => {
						const parent = path.join(directory, layout);
						mkdirSync(parent, { recursive: true });
						writeFileSync(
							path.join(parent, "package.json"),
							JSON.stringify({ name, type: "module" }),
						);
						const importer = path.join(parent, "entry.js");
						writeFileSync(importer, "export const application = true;");
						expect(() =>
							resolveAuthorRequest(request + query, importer),
						).toThrow(/cannot mark CSS/);
					},
				),
				properties,
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("keeps compiler bridge ownership closed for absent, shim and sibling importers", () => {
		const bridge = "/virtual/author-style-resolve.js";
		for (const importer of [
			undefined,
			path.join(renderer, ".ignite-jsx-shims/application.js"),
			path.join(renderer, ".ignite-jsx-shims\\application.js"),
			path.join(renderer, "packages/jsx-plugin/dist/application.js"),
			path.join(`${renderer}-application`, "dist/entry.js"),
		])
			expect(() => resolveAuthorRequest(bridge, importer)).toThrow(
				/cannot mark CSS/,
			);
		expect(resolveAuthorRequest(bridge, path.join(source, "renderer.ts"))).toBe(
			mark,
		);
	});

	it("keeps renderer and element registries private to their owning package", () => {
		const element = path.resolve(renderer, "../ignite-element");
		const elementImporter = path.join(element, "dist/ignite-element.es.js");
		const elementMark = path.join(element, "dist/jsx/author-style-mark.es.js");
		expect(resolveAuthorRequest(elementMark, elementImporter)).toBeNull();
		expect(() => resolveAuthorRequest(mark, elementImporter)).toThrow(
			/cannot mark CSS/,
		);
		expect(() =>
			resolveAuthorRequest(elementMark, path.join(source, "renderer.ts")),
		).toThrow(/cannot mark CSS/);
	});

	it("keeps a second element installation's mark local and rejects its application source", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "ignite-second-owner-"));
		try {
			const importer = path.join(directory, "dist/index.js");
			const localMark = path.join(
				directory,
				"dist/jsx/author-style-mark.es.js",
			);
			const application = path.join(directory, "src/application.js");
			mkdirSync(path.dirname(localMark), { recursive: true });
			mkdirSync(path.dirname(application), { recursive: true });
			writeFileSync(
				path.join(directory, "package.json"),
				JSON.stringify({
					name: "ignite-element",
					type: "module",
					exports: { ".": "./dist/index.js" },
				}),
			);
			writeFileSync(importer, "export const installed = true;");
			writeFileSync(localMark, "export const localOnly = true;");
			writeFileSync(application, "export const application = true;");
			expect(resolveAuthorRequest(localMark, importer)).toBeNull();
			expect(() => resolveAuthorRequest(mark, importer)).toThrow(
				/cannot mark CSS/,
			);
			expect(() => resolveAuthorRequest(localMark, application)).toThrow(
				/cannot mark CSS/,
			);
			const broken = path.join(directory, "broken");
			const brokenImporter = path.join(broken, "dist/index.js");
			mkdirSync(path.dirname(brokenImporter), { recursive: true });
			writeFileSync(brokenImporter, "export const installed = true;");
			writeFileSync(
				path.join(broken, "package.json"),
				JSON.stringify({
					name: "ignite-element",
					type: "module",
					exports: { ".": "./missing.js" },
				}),
			);
			expect(() => resolveAuthorRequest(mark, brokenImporter)).toThrow(
				/cannot mark CSS/,
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("rejects an application symlink importer and a foreign mark even from the real renderer", () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "ignite-provenance-link-"),
		);
		try {
			const importer = path.join(directory, "renderer.js");
			symlinkSync(path.join(source, "renderer.ts"), importer);
			expect(() => resolveAuthorRequest(mark, importer)).toThrow(
				/cannot mark CSS/,
			);
			const foreign = path.join(directory, "renderers/jsx/authorStyle.ts");
			mkdirSync(path.dirname(foreign), { recursive: true });
			writeFileSync(foreign, "export const fake = true;");
			expect(() =>
				resolveAuthorRequest(foreign, path.join(source, "renderer.ts")),
			).toThrow(/cannot mark CSS/);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("recognizes library ownership through the bundled voice-workbench configuration", () => {
		const directory = mkdtempSync(
			path.join(tmpdir(), "ignite-workspace-config-"),
		);
		const installed = path.join(
			directory,
			"node_modules/@ignite-element/renderer",
		);
		mkdirSync(installed, { recursive: true });
		writeFileSync(
			path.join(installed, "package.json"),
			JSON.stringify({
				name: "@ignite-element/renderer",
				type: "module",
				exports: "./index.js",
			}),
		);
		writeFileSync(
			path.join(installed, "index.js"),
			"export const previousInstall=true;",
		);
		try {
			const configuration = path.join(directory, "vite.config.mjs");
			const exampleConfig = fileURLToPath(
				new URL(
					"../../../examples/agents/voice-workbench/vite.config.ts",
					import.meta.url,
				),
			);
			writeFileSync(
				configuration,
				`import {createVoiceWorkbenchViteConfig} from ${JSON.stringify(exampleConfig)}; export default createVoiceWorkbenchViteConfig({});`,
			);
			const require = createRequire(import.meta.url);
			const script = path.join(directory, "probe.mjs");
			writeFileSync(
				script,
				`import assert from "node:assert/strict";
import {loadConfigFromFile} from ${JSON.stringify(require.resolve("vite"))};
const loaded = await loadConfigFromFile({command:"build",mode:"production"}, ${JSON.stringify(configuration)});
const plugin = loaded.config.plugins[0];
const result = await plugin.resolveId.handler.call({error(message){throw Error(message);}}, "./authorStyle", ${JSON.stringify(path.join(source, "renderer.ts"))});
assert.equal(result, null);
`,
			);
			execFileSync(process.execPath, [script], {
				cwd: directory,
				env: { ...process.env, NODE_PATH: "" },
				stdio: "pipe",
				timeout: 30000,
			});
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("builds a source-aliased consumer with one registry for trusted and untrusted styles", async () => {
		const directory = mkdtempSync(
			path.join(
				fileURLToPath(new URL("..", import.meta.url)),
				".workspace-provenance-",
			),
		);
		const authorUrl = "https://example.test/author.png";
		const untrustedUrl = "https://example.test/untrusted.png";
		// An isolated example may install a published renderer while aliasing source.
		const installed = path.join(
			directory,
			"node_modules/@ignite-element/renderer",
		);
		mkdirSync(installed, { recursive: true });
		writeFileSync(
			path.join(installed, "package.json"),
			JSON.stringify({
				name: "@ignite-element/renderer",
				type: "module",
				exports: "./index.js",
			}),
		);
		writeFileSync(
			path.join(installed, "index.js"),
			"export const olderInstall = true;",
		);
		const entry = path.join(directory, "entry.tsx");
		writeFileSync(
			entry,
			`import {mountIgniteJsxOnce} from "@ignite-element/renderer/jsx";
const sheet = ".proof{background-image:url(${authorUrl})}";
export function render(host, dynamic) {
 mountIgniteJsxOnce(host, <><style>{sheet}</style><style>{dynamic}</style><div class="proof">Ready</div></>);
}`,
		);
		try {
			const configuration = path.join(directory, "vite.config.mjs");
			const settings = {
				root: directory,
				define: {
					__IGNITE_DEV_WARNINGS__: "false",
					__IGNITE_HOST_RUNTIME__: "false",
				},
				esbuild: { jsx: "automatic", jsxImportSource: "ignite-element/jsx" },
				resolve: {
					alias: [
						{
							find: "@ignite-element/renderer/jsx",
							replacement: path.join(renderer, "src/renderers/ignite-jsx.ts"),
						},
						{
							find: "ignite-element/jsx/jsx-runtime",
							replacement: path.join(renderer, "src/jsx/jsx-runtime.ts"),
						},
						{
							find: "ignite-element/jsx/jsx-dev-runtime",
							replacement: path.join(renderer, "src/jsx/jsx-dev-runtime.ts"),
						},
					],
				},
				build: {
					minify: false,
					lib: { entry, formats: ["iife"], name: "proof" },
				},
			};
			writeFileSync(
				configuration,
				`import ignite from ${JSON.stringify(fileURLToPath(new URL("./vite.ts", import.meta.url)))}; export default { ...${JSON.stringify(settings)}, plugins: [ignite({jsxImportSource:"ignite-element/jsx"})] };`,
			);
			const require = createRequire(import.meta.url);
			const cli = path.join(
				path.dirname(require.resolve("vite/package.json")),
				"bin/vite.js",
			);
			execFileSync(
				process.execPath,
				[cli, "build", "--config", configuration],
				{
					cwd: directory,
					env: { ...process.env, NODE_ENV: "production", NODE_PATH: "" },
					stdio: "pipe",
					timeout: 30000,
				},
			);
			const output = path.join(directory, "dist");
			const code = readdirSync(output)
				.filter((file) => file.endsWith(".js"))
				.map((file) => readFileSync(path.join(output, file), "utf8"))
				.join("\n");
			const dom = new JSDOM("<!doctype html><body><main></main></body>", {
				runScripts: "outside-only",
				url: "https://example.test/",
			});
			try {
				dom.window.eval(
					code +
						`\nproof.render(document.querySelector("main"), ${JSON.stringify(`.proof{background-image:url(${untrustedUrl})}`)});`,
				);
				const styles = Array.from(
					dom.window.document.querySelectorAll("style"),
					(element) => element.textContent,
				).join("\n");
				expect(styles).toContain(authorUrl);
				expect(styles).not.toContain(untrustedUrl);
				expect(dom.window.document.querySelector(".proof")?.textContent).toBe(
					"Ready",
				);
			} finally {
				dom.window.close();
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
