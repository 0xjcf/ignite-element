import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfigFile } from "./configFile";

export interface IgniteConfigVitePluginOptions {
	/**
	 * Relative (from Vite root) or absolute path to the config file.
	 * When omitted, the plugin looks for common `ignite.config.*` filenames.
	 */
	configPath?: string;
	/**
	 * Override the HTML injection location. Defaults to `head-prepend`.
	 */
	injectTo?: "head" | "head-prepend" | "body" | "body-prepend";
	/**
	 * Optional root directory to use instead of waiting for Vite's
	 * `configResolved` hook. Handy for tests or custom tooling.
	 */
	root?: string;
}

function fileExists(path: string | undefined): path is string {
	return Boolean(path);
}

function toPosixPath(path: string): string {
	return path.split(sep).join("/");
}

function toFileSystemPath(path: string): string {
	return `/@fs/${toPosixPath(path)}`;
}

const moduleDirectory =
	typeof __dirname === "string"
		? __dirname
		: fileURLToPath(new URL(".", import.meta.url));

function resolveLoadHelperSpecifier(): string | undefined {
	const candidates = [
		"../config/loadIgniteConfig.ts",
		"../config/loadIgniteConfig.js",
		"../config/loadIgniteConfig.mjs",
		"../config/loadIgniteConfig.es.js",
		"../config/loadIgniteConfig.es.mjs",
		"../config/loadIgniteConfig.cjs",
	];

	for (const candidate of candidates) {
		const absolute = resolve(moduleDirectory, candidate);
		if (existsSync(absolute)) {
			return toFileSystemPath(absolute);
		}
	}

	return undefined;
}

type ConfigWithRoot = { root: string };

export function igniteConfigVitePlugin(
	options: IgniteConfigVitePluginOptions = {},
) {
	let projectRoot = options.root;
	let resolvedConfigPath =
		options.root === undefined
			? undefined
			: resolveConfigFile({
					root: options.root,
					configPath: options.configPath,
				});

	const configResolved = (config: ConfigWithRoot) => {
		projectRoot = options.root ?? config.root;
		resolvedConfigPath =
			resolvedConfigPath ??
			resolveConfigFile({
				root: projectRoot,
				configPath: options.configPath,
			});
	};

	const transformIndexHtml = () => {
		if (!fileExists(resolvedConfigPath)) {
			return;
		}

		const injectTo = options.injectTo ?? "head-prepend";

		const importSpecifier = getImportSpecifier(resolvedConfigPath, projectRoot);

		if (!importSpecifier) {
			return;
		}

		const loadHelperFallback = resolveLoadHelperSpecifier();
		const loadHelperImport = JSON.stringify(
			"ignite-element/config/loadIgniteConfig",
		);
		const fallbackImport = loadHelperFallback
			? `({ loadIgniteConfig } = await import(${JSON.stringify(loadHelperFallback)}));`
			: `throw error;`;
		const configModuleImport = JSON.stringify(importSpecifier);
		const script = `let loadIgniteConfig;
try {
	({ loadIgniteConfig } = await import(${loadHelperImport}));
} catch (error) {
	${fallbackImport}
}
await loadIgniteConfig(() => import(${configModuleImport}));`;

		const tags = [
			{
				tag: "script",
				attrs: { type: "module" },
				children: script,
				injectTo,
			},
		];

		return tags;
	};

	const enforce: "pre" = "pre";

	const plugin = {
		name: "ignite-element:vite-config",
		enforce,
		configResolved,
		transformIndexHtml,
	};

	return plugin;
}

function getImportSpecifier(
	configPath: string | undefined,
	root: string | undefined,
): string | undefined {
	if (!fileExists(configPath)) {
		return undefined;
	}

	if (root) {
		const relativePath = relative(root, configPath);
		if (relativePath && !relativePath.startsWith("..")) {
			const normalized = toPosixPath(relativePath);
			return normalized.startsWith(".") ? normalized : `./${normalized}`;
		}
	}

	return toFileSystemPath(configPath);
}
