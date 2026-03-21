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
	moduleId: string,
): string[] {
	const existing = Array.isArray(value) ? value : [value];

	if (existing.includes(moduleId)) {
		return existing;
	}

	return [moduleId, ...existing];
}

function prependConfig(
	entry: EntryDescriptor,
	moduleId: string,
): EntryDescriptor {
	if (typeof entry === "string") {
		return normalizeToArray(entry, moduleId);
	}

	if (Array.isArray(entry)) {
		return normalizeToArray(entry, moduleId);
	}

	if (entry && typeof entry === "object" && "import" in entry) {
		return {
			...entry,
			import: normalizeToArray(entry.import as string | string[], moduleId),
		};
	}

	return entry;
}

function applyConfigToEntry(
	entry: WebpackEntry | undefined,
	moduleId: string,
): WebpackEntry {
	if (!entry) {
		return {
			main: {
				import: [moduleId],
			},
		};
	}

	if (typeof entry === "function") {
		return async () => applyConfigToEntry(await entry(), moduleId);
	}

	if (typeof entry === "string" || Array.isArray(entry)) {
		return prependConfig(entry, moduleId);
	}

	if (typeof entry === "object") {
		const next: Record<string, EntryDescriptor> = {};
		for (const [key, value] of Object.entries(entry)) {
			next[key] = prependConfig(value as EntryDescriptor, moduleId);
		}
		return next;
	}

	return entry;
}

function createLoaderModule(configFile: string): string {
	const source = `import { loadIgniteConfig } from "ignite-element/config/loadIgniteConfig";
await loadIgniteConfig(() => import(${JSON.stringify(configFile)}));`;
	return `data:text/javascript,${encodeURIComponent(source)}`;
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

		const loaderModule = createLoaderModule(configFile);

		compiler.options.entry = applyConfigToEntry(
			compiler.options.entry,
			loaderModule,
		);
	}
}
