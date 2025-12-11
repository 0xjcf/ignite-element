import { relative, resolve, sep } from "node:path";
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

function isValidPath(path: string | undefined): path is string {
	return Boolean(path);
}

function toPosixPath(path: string): string {
	return path.split(sep).join("/");
}

function toFileSystemPath(path: string): string {
	const normalized = toPosixPath(path).replace(/^\/+/, "");
	return `/@fs/${normalized}`;
}

const DEFAULT_LOAD_HELPER_SPECIFIER = "ignite-element/config/loadIgniteConfig";

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
		if (!isValidPath(resolvedConfigPath)) {
			console.warn("[ignite-element:vite-config] no config file found");
			return;
		}

		const injectTo = options.injectTo ?? "head-prepend";

		const importSpecifier = getImportSpecifier(resolvedConfigPath, projectRoot);

		if (!importSpecifier) {
			console.warn(
				"[ignite-element:vite-config] unable to resolve import specifier",
				{ resolvedConfigPath, projectRoot },
			);
			return;
		}

		const loadHelperSpecifier = projectRoot
			? toFileSystemPath(
					resolve(
						projectRoot,
						"node_modules/ignite-element/dist/config/loadIgniteConfig.es.js",
					),
				)
			: DEFAULT_LOAD_HELPER_SPECIFIER;

		const loadHelperImport = JSON.stringify(loadHelperSpecifier);
		const configModuleImport = JSON.stringify(importSpecifier);
		const script = `const { loadIgniteConfig } = await import(${loadHelperImport});
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
	if (!isValidPath(configPath)) {
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
