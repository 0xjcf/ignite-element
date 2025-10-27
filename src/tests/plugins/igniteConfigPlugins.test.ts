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
			expect(injected?.children).toContain(
				'await loadIgniteConfig(() => import("./ignite.config.ts"));',
			);
			expect(injected?.children).toContain(
				'await import("ignite-element/config/loadIgniteConfig")',
			);
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("uses /@fs imports when the config file is outside the project root", () => {
		const root = createTempProject({});
		const externalRoot = mkdtempSync(
			join(process.cwd(), ".tmp-ignite-config-external-"),
		);
		const configFile = resolve(externalRoot, "ignite.config.ts");
		writeFileSync(configFile, "export default {}");

		const plugin = igniteConfigVitePlugin({ root, configPath: configFile });
		const tags = runIndexHtml(plugin.transformIndexHtml);

		expect(Array.isArray(tags)).toBe(true);
		if (Array.isArray(tags)) {
			expect(tags[0]?.children).toMatch(
				/await loadIgniteConfig\(\(\) => import\("\/@fs\/.+ignite\.config\.ts"\)\);/,
			);
			expect(tags[0]?.children).toContain(
				'await import("ignite-element/config/loadIgniteConfig")',
			);
		}

		rmSync(root, { recursive: true, force: true });
		rmSync(externalRoot, { recursive: true, force: true });
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
			expect(tags[0]?.children).toContain(
				'await loadIgniteConfig(() => import("./ignite.config.ts"));',
			);
			expect(tags[0]?.children).toContain(
				'await import("ignite-element/config/loadIgniteConfig")',
			);
		}

		rmSync(root, { recursive: true, force: true });
	});
});

function expectConfigLoader(moduleId: string, configFile: string) {
	expect(moduleId.startsWith("data:text/javascript,")).toBe(true);
	const decoded = decodeURIComponent(
		moduleId.replace("data:text/javascript,", ""),
	);
	expect(decoded).toContain(
		`await loadIgniteConfig(() => import(${JSON.stringify(configFile)}));`,
	);
}

describe("IgniteConfigWebpackPlugin", () => {
	it("prepends a loader module to simple string entries", async () => {
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

		expect(Array.isArray(compiler.options.entry)).toBe(true);
		if (Array.isArray(compiler.options.entry)) {
			const [loader, original] = compiler.options.entry;
			expectConfigLoader(loader as string, configFile);
			expect(original).toBe("./src/index.js");
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("injects the loader into object style entries", () => {
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

		expect(typeof compiler.options.entry).toBe("object");
		if (
			compiler.options.entry &&
			typeof compiler.options.entry === "object" &&
			!Array.isArray(compiler.options.entry)
		) {
			const mainEntry = compiler.options.entry.main as string[];
			expect(Array.isArray(mainEntry)).toBe(true);
			if (Array.isArray(mainEntry)) {
				const [loader, original] = mainEntry;
				expectConfigLoader(loader as string, configFile);
				expect(original).toBe("./src/index.js");
			}
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("prepends the loader when entry is a function", async () => {
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
			expect(Array.isArray(resolved)).toBe(true);
			if (Array.isArray(resolved)) {
				const [loader, original] = resolved;
				expectConfigLoader(loader as string, configFile);
				expect(original).toBe("./src/index.js");
			}
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

		expect(typeof compiler.options.entry).toBe("object");
		if (
			compiler.options.entry &&
			typeof compiler.options.entry === "object" &&
			!Array.isArray(compiler.options.entry)
		) {
			const mainEntry = (compiler.options.entry.main as { import: string[] })
				.import;
			expect(Array.isArray(mainEntry)).toBe(true);
			if (Array.isArray(mainEntry)) {
				const [loader, original] = mainEntry;
				expectConfigLoader(loader as string, configFile);
				expect(original).toBe("./src/index.js");
			}

			const adminEntry = compiler.options.entry.admin as string[];
			expect(Array.isArray(adminEntry)).toBe(true);
			if (Array.isArray(adminEntry)) {
				const [loader, original] = adminEntry;
				expectConfigLoader(loader as string, configFile);
				expect(original).toBe("./src/admin.js");
			}
		}

		rmSync(root, { recursive: true, force: true });
	});

	it("avoids duplicating the loader when already present", () => {
		const root = createTempProject({
			"ignite.config.ts": "export default {}",
		});

		const configFile = resolve(root, "ignite.config.ts");
		const loaderModule = `data:text/javascript,${encodeURIComponent(
			`import { loadIgniteConfig } from "ignite-element/config/loadIgniteConfig";\nawait loadIgniteConfig(() => import(${JSON.stringify(configFile)}));`,
		)}`;

		const compiler: WebpackCompilerLike = {
			context: root,
			options: {
				entry: {
					main: [loaderModule, "./src/index.js"],
				},
			},
		};

		const plugin = new IgniteConfigWebpackPlugin();
		plugin.apply(compiler);

		expect(compiler.options.entry).toEqual({
			main: [loaderModule, "./src/index.js"],
		});

		rmSync(root, { recursive: true, force: true });
	});
});
