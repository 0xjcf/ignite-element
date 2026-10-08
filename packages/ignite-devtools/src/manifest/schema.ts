import {
	type ManifestValidationOptions,
	validateDevtoolsManifest,
} from "./validate";

/** Manifest document version. Wire messages use their own `v`. */
export const DEVTOOLS_MANIFEST_VERSION = 1 as const;

export type ManifestAdapter = "xstate" | "redux" | "mobx" | "actor-web";

export type ManifestFlagKind = "can" | "show" | "is";

export type ManifestFlag = {
	name: string;
	kind: ManifestFlagKind;
};

export type ManifestCommand = {
	name: string;
	nativeEvent?: string;
	flag?: string;
	port?: string;
};

export type ManifestSource = {
	id: string;
	adapter: ManifestAdapter;
	declaredStates: string[];
	flags: ManifestFlag[];
	commands: ManifestCommand[];
	events: string[];
	ports: string[];
	hosts: string[];
};

/**
 * Catalog components have no separate id in the build list.
 * M0 uses the PascalCase catalog name as both `id` and `name`.
 */
export type ManifestComponent = {
	id: string;
	name: string;
};

export type DevtoolsManifest = {
	version: typeof DEVTOOLS_MANIFEST_VERSION;
	app: string;
	sources: ManifestSource[];
	components: ManifestComponent[];
};

export function defineDevtoolsManifest(
	input: DevtoolsManifest,
	options?: ManifestValidationOptions,
): DevtoolsManifest {
	const result = validateDevtoolsManifest(input, options);
	if (!result.ok) {
		const details = result.errors
			.map((error) => `${error.path}: ${error.message}`)
			.join("\n");
		throw new Error(`Invalid devtools manifest:\n${details}`);
	}
	return result.manifest;
}
