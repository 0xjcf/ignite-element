import { relative, sep } from "node:path";
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

		const tags = [
			{
				tag: "script",
				attrs: { type: "module" },
				children: `import ${JSON.stringify(importSpecifier)};`,
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
