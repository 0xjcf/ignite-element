import { resolveConfigFile } from "./configFile";

export interface IgniteConfigWebpackPluginOptions {
	configPath?: string;
}

type EntryDescriptor =
	| string
	| string[]
	| {
			import: string | string[];
			[key: string]: unknown;
	  };

export type WebpackEntry =
	| EntryDescriptor
	| Record<string, EntryDescriptor>
	| (() => WebpackEntry | Promise<WebpackEntry>);

export interface WebpackCompilerLike {
	context: string;
	options: {
		entry?: WebpackEntry;
		[key: string]: unknown;
	};
}

function normalizeToArray(
	value: string | string[],
	configFile: string,
): string[] {
	const existing = Array.isArray(value) ? value : [value];

	if (existing.includes(configFile)) {
		return existing;
	}

	return [configFile, ...existing];
}

function prependConfig(
	entry: EntryDescriptor,
	configFile: string,
): EntryDescriptor {
	if (typeof entry === "string") {
		return normalizeToArray(entry, configFile);
	}

	if (Array.isArray(entry)) {
		return normalizeToArray(entry, configFile);
	}

	if (entry && typeof entry === "object" && "import" in entry) {
		return {
			...entry,
			import: normalizeToArray(entry.import as string | string[], configFile),
		};
	}

	return entry;
}

function applyConfigToEntry(
	entry: WebpackEntry | undefined,
	configFile: string,
): WebpackEntry {
	if (!entry) {
		return {
			main: {
				import: [configFile],
			},
		};
	}

	if (typeof entry === "function") {
		return async () => applyConfigToEntry(await entry(), configFile);
	}

	if (typeof entry === "string" || Array.isArray(entry)) {
		return prependConfig(entry, configFile);
	}

	if (typeof entry === "object") {
		const next: Record<string, EntryDescriptor> = {};
		for (const [key, value] of Object.entries(entry)) {
			next[key] = prependConfig(value as EntryDescriptor, configFile);
		}
		return next;
	}

	return entry;
}

export class IgniteConfigWebpackPlugin {
	private readonly options: IgniteConfigWebpackPluginOptions;

	constructor(options: IgniteConfigWebpackPluginOptions = {}) {
		this.options = options;
	}

	apply(compiler: WebpackCompilerLike) {
		const configFile = resolveConfigFile({
			root: compiler.context,
			configPath: this.options.configPath,
		});

		if (!configFile) {
			return;
		}

		compiler.options.entry = applyConfigToEntry(
			compiler.options.entry,
			configFile,
		);
	}
}
