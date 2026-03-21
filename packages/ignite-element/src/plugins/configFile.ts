import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const DEFAULT_CONFIG_FILES = [
	"ignite.config.ts",
	"ignite.config.js",
	"ignite.config.mjs",
	"ignite.config.cjs",
];

export interface ConfigFileOptions {
	root: string;
	configPath?: string;
}

export function resolveConfigFile({
	root,
	configPath,
}: ConfigFileOptions): string | undefined {
	if (configPath) {
		const candidate = isAbsolute(configPath)
			? configPath
			: resolve(root, configPath);
		return existsSync(candidate) ? candidate : undefined;
	}

	for (const file of DEFAULT_CONFIG_FILES) {
		const candidate = resolve(root, file);
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return undefined;
}
