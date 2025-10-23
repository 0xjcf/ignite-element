/* @vitest-environment node */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveConfig } from "vite";
import { describe, expect, it } from "vitest";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";
import type { WebpackCompilerLike } from "../../plugins/webpackIgniteConfigPlugin";
import { IgniteConfigWebpackPlugin } from "../../plugins/webpackIgniteConfigPlugin";
import { runConfigResolved, runIndexHtml } from "../helpers/vitePluginHarness";

function createTempProject(structure: Record<string, string>): string {
	const dir = mkdtempSync(join(process.cwd(), ".tmp-ignite-config-"));
	for (const [relativePath, contents] of Object.entries(structure)) {
		const filePath = resolve(dir, relativePath);
		const parentDir = resolve(filePath, "..");
		if (parentDir !== dir) {
			mkdirSync(parentDir, { recursive: true });
		}
		writeFileSync(filePath, contents);
	}
	return dir;
}

describe("igniteConfigVitePlugin", () => {
	it("injects the config entry when a config file exists", () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const plugin = igniteConfigVitePlugin({ root });
		const tags = runIndexHtml(plugin.transformIndexHtml);

		expect(Array.isArray(tags)).toBe(true);
		if (Array.isArray(tags)) {
			expect(tags).toHaveLength(1);
			const injected = tags[0];
			expect(injected?.tag).toBe("script");
			expect(injected?.children).toBe('import "./ignite.config.ts";');
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("skips injection when no config file is found", () => {
		const root = createTempProject({});

		const plugin = igniteConfigVitePlugin({ root });
		const tags = runIndexHtml(plugin.transformIndexHtml);

		expect(tags).toBeUndefined();

		rmSync(root, { recursive: true, force: true });
	});

	it("supports resolving config during configResolved hook", async () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const plugin = igniteConfigVitePlugin({ injectTo: "body" });
		const config = await resolveConfig(
			{
				root,
				configFile: false,
				plugins: [],
			},
			"build",
		);

		runConfigResolved(plugin.configResolved, config);

		const tags = runIndexHtml(plugin.transformIndexHtml);

		expect(Array.isArray(tags)).toBe(true);
		if (Array.isArray(tags)) {
			expect(tags[0]?.injectTo).toBe("body");
			expect(tags[0]?.children).toBe('import "./ignite.config.ts";');
		}

		rmSync(root, { recursive: true, force: true });
	});
});

describe("IgniteConfigWebpackPlugin", () => {
	it("prepends the config file to simple string entries", async () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: "./src/index.js",
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual([configFile, "./src/index.js"]);

		rmSync(root, { recursive: true, force: true });
	});

	it("injects the config file into object style entries", () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: {
					main: "./src/index.js",
				},
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual({
			main: [configFile, "./src/index.js"],
		});

		rmSync(root, { recursive: true, force: true });
	});

	it("prepends config when entry is a function", async () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: () => Promise.resolve("./src/index.js"),
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		const entry = compiler.options.entry;
		expect(typeof entry).toBe("function");
		if (typeof entry === "function") {
			const resolved = await entry();
			expect(resolved).toEqual([configFile, "./src/index.js"]);
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("leaves entries untouched when the config file is missing", () => {
		const root = createTempProject({});

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: "./src/index.js",
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual("./src/index.js");

		rmSync(root, { recursive: true, force: true });
	});

	it("respects nested entry descriptors", () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: {
					main: {
						import: "./src/index.js",
					},
					admin: ["./src/admin.js"],
				},
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual({
			main: {
				import: [configFile, "./src/index.js"],
			},
			admin: [configFile, "./src/admin.js"],
		});

		rmSync(root, { recursive: true, force: true });
	});

	it("avoids duplicating config when already present", () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: {
					main: [configFile, "./src/index.js"],
				},
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual({
			main: [configFile, "./src/index.js"],
		});

		rmSync(root, { recursive: true, force: true });
	});
});
