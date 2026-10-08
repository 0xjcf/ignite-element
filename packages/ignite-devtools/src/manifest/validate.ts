import type {
	DevtoolsManifest,
	ManifestAdapter,
	ManifestCommand,
	ManifestComponent,
	ManifestFlag,
	ManifestFlagKind,
	ManifestSource,
} from "./schema";
import { DEVTOOLS_MANIFEST_VERSION } from "./schema";

export type ManifestIssue = {
	path: string;
	message: string;
};

export type ManifestValidation =
	| { ok: true; manifest: DevtoolsManifest }
	| { ok: false; errors: readonly ManifestIssue[] };

export type ManifestValidationOptions = {
	/**
	 * When set, `components` must be exactly these catalog names, once each.
	 * The build list has no separate id, so each entry's id is that name.
	 */
	componentNames?: readonly string[];
};

const ADAPTERS = ["xstate", "redux", "mobx", "actor-web"] as const;
const FLAG_KINDS = ["can", "show", "is"] as const;
const FLAG_NAME = /^(can|show|is)[A-Z][A-Za-z0-9]*$/;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[a-z][a-z0-9-]*$/;

const MANIFEST_KEYS = ["version", "app", "sources", "components"] as const;
const SOURCE_KEYS = [
	"id",
	"adapter",
	"declaredStates",
	"flags",
	"commands",
	"events",
	"ports",
	"hosts",
] as const;
const FLAG_KEYS = ["name", "kind"] as const;
const COMMAND_KEYS = ["name", "nativeEvent", "flag", "port"] as const;
const COMPONENT_KEYS = ["id", "name"] as const;

export function validateDevtoolsManifest(
	input: unknown,
	options?: ManifestValidationOptions,
): ManifestValidation {
	const errors: ManifestIssue[] = [];
	const manifest = readManifest(input, errors, options);
	if (errors.length > 0 || !manifest) {
		return { ok: false, errors };
	}
	return { ok: true, manifest: structuredClone(manifest) };
}

function readManifest(
	input: unknown,
	errors: ManifestIssue[],
	options: ManifestValidationOptions | undefined,
): DevtoolsManifest | undefined {
	if (!isRecord(input)) {
		errors.push(issue("", "manifest must be an object"));
		return undefined;
	}
	rejectUnknown(input, MANIFEST_KEYS, "", errors);

	if (input.version !== DEVTOOLS_MANIFEST_VERSION) {
		errors.push(issue("version", `must be ${DEVTOOLS_MANIFEST_VERSION}`));
	}
	if (!isNonEmptyString(input.app) || input.app !== input.app.trim()) {
		errors.push(issue("app", "must be a non-empty string"));
	}

	const sources = readSources(input.sources, errors);
	const components = readComponents(input.components, errors, options);
	if (
		errors.length > 0 ||
		!sources ||
		!components ||
		typeof input.app !== "string"
	) {
		return undefined;
	}

	return {
		version: DEVTOOLS_MANIFEST_VERSION,
		app: input.app,
		sources,
		components,
	};
}

function readSources(
	input: unknown,
	errors: ManifestIssue[],
): ManifestSource[] | undefined {
	if (!Array.isArray(input)) {
		errors.push(issue("sources", "must be an array"));
		return undefined;
	}
	const sources: ManifestSource[] = [];
	const ids = new Set<string>();
	for (let index = 0; index < input.length; index += 1) {
		const source = readSource(input[index], `sources[${index}]`, errors);
		if (!source) continue;
		if (ids.has(source.id)) {
			errors.push(
				issue(`sources[${index}].id`, `duplicate source id "${source.id}"`),
			);
		}
		ids.add(source.id);
		sources.push(source);
	}
	return errors.length > 0 ? undefined : sources;
}

function readSource(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): ManifestSource | undefined {
	if (!isRecord(input)) {
		errors.push(issue(path, "must be an object"));
		return undefined;
	}
	rejectUnknown(input, SOURCE_KEYS, path, errors);

	const id = readIdentifier(input.id, `${path}.id`, errors);
	const adapter = readAdapter(input.adapter, `${path}.adapter`, errors);
	const declaredStates = readStringList(
		input.declaredStates,
		`${path}.declaredStates`,
		errors,
	);
	const flags = readFlags(input.flags, `${path}.flags`, errors);
	const ports = readIdentifierList(input.ports, `${path}.ports`, errors);
	const events = readStringList(input.events, `${path}.events`, errors);
	const hosts = readStringList(input.hosts, `${path}.hosts`, errors);
	const commands = readCommands(
		input.commands,
		`${path}.commands`,
		errors,
		flags?.map((flag) => flag.name) ?? [],
		ports ?? [],
	);

	if (
		!id ||
		!adapter ||
		!declaredStates ||
		!flags ||
		!ports ||
		!events ||
		!hosts ||
		!commands
	) {
		return undefined;
	}
	return {
		id,
		adapter,
		declaredStates,
		flags,
		commands,
		events,
		ports,
		hosts,
	};
}

function readFlags(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): ManifestFlag[] | undefined {
	if (!Array.isArray(input)) {
		errors.push(issue(path, "must be an array"));
		return undefined;
	}
	const flags: ManifestFlag[] = [];
	const names = new Set<string>();
	for (let index = 0; index < input.length; index += 1) {
		const flag = readFlag(input[index], `${path}[${index}]`, errors);
		if (!flag) continue;
		if (names.has(flag.name)) {
			errors.push(
				issue(`${path}[${index}].name`, `duplicate flag "${flag.name}"`),
			);
		}
		names.add(flag.name);
		flags.push(flag);
	}
	return flags;
}

function readFlag(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): ManifestFlag | undefined {
	if (!isRecord(input)) {
		errors.push(issue(path, "must be an object"));
		return undefined;
	}
	rejectUnknown(input, FLAG_KEYS, path, errors);
	const name = typeof input.name === "string" ? input.name : "";
	if (!FLAG_NAME.test(name)) {
		errors.push(issue(`${path}.name`, "must start with can, show, or is"));
	}
	const kind = input.kind;
	if (!isFlagKind(kind)) {
		errors.push(issue(`${path}.kind`, "must be can, show, or is"));
		return undefined;
	}
	const prefix = name.startsWith("can")
		? "can"
		: name.startsWith("show")
			? "show"
			: name.startsWith("is")
				? "is"
				: undefined;
	if (prefix && prefix !== kind) {
		errors.push(issue(`${path}.kind`, `must be "${prefix}" to match ${name}`));
	}
	if (!FLAG_NAME.test(name)) return undefined;
	return { name, kind };
}

function readCommands(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
	flagNames: readonly string[],
	portNames: readonly string[],
): ManifestCommand[] | undefined {
	if (!Array.isArray(input)) {
		errors.push(issue(path, "must be an array"));
		return undefined;
	}
	const commands: ManifestCommand[] = [];
	const names = new Set<string>();
	for (let index = 0; index < input.length; index += 1) {
		const command = readCommand(
			input[index],
			`${path}[${index}]`,
			flagNames,
			portNames,
			errors,
		);
		if (!command) continue;
		if (names.has(command.name)) {
			errors.push(
				issue(`${path}[${index}].name`, `duplicate command "${command.name}"`),
			);
		}
		names.add(command.name);
		commands.push(command);
	}
	return commands;
}

function readCommand(
	input: unknown,
	path: string,
	flagNames: readonly string[],
	portNames: readonly string[],
	errors: ManifestIssue[],
): ManifestCommand | undefined {
	if (!isRecord(input)) {
		errors.push(issue(path, "must be an object"));
		return undefined;
	}
	rejectUnknown(input, COMMAND_KEYS, path, errors);
	const name = readIdentifier(input.name, `${path}.name`, errors);
	const command: ManifestCommand = { name: name ?? "" };
	if ("nativeEvent" in input) {
		if (!isNonEmptyString(input.nativeEvent)) {
			errors.push(issue(`${path}.nativeEvent`, "must be a non-empty string"));
		} else {
			command.nativeEvent = input.nativeEvent;
		}
	}
	if ("flag" in input) {
		if (typeof input.flag !== "string" || !flagNames.includes(input.flag)) {
			errors.push(issue(`${path}.flag`, "must name a flag on this source"));
		} else {
			command.flag = input.flag;
		}
	}
	if ("port" in input) {
		if (typeof input.port !== "string" || !portNames.includes(input.port)) {
			errors.push(issue(`${path}.port`, "must name a port on this source"));
		} else {
			command.port = input.port;
		}
	}
	return name ? command : undefined;
}

function readComponents(
	input: unknown,
	errors: ManifestIssue[],
	options: ManifestValidationOptions | undefined,
): ManifestComponent[] | undefined {
	if (!Array.isArray(input)) {
		errors.push(issue("components", "must be an array"));
		return undefined;
	}
	const components: ManifestComponent[] = [];
	const names = new Set<string>();
	for (let index = 0; index < input.length; index += 1) {
		const component = readComponent(
			input[index],
			`components[${index}]`,
			errors,
		);
		if (!component) continue;
		if (names.has(component.name)) {
			errors.push(
				issue(
					`components[${index}].name`,
					`duplicate component "${component.name}"`,
				),
			);
		}
		names.add(component.name);
		components.push(component);
	}

	const expected = options?.componentNames;
	if (expected) {
		const actual = new Set(components.map((component) => component.name));
		for (const name of actual) {
			if (!expected.includes(name)) {
				errors.push(
					issue("components", `"${name}" is not a catalog component`),
				);
			}
		}
		for (const name of expected) {
			if (!actual.has(name)) {
				errors.push(issue("components", `missing catalog component "${name}"`));
			}
		}
	}

	return components;
}

function readComponent(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): ManifestComponent | undefined {
	if (!isRecord(input)) {
		errors.push(issue(path, "must be an object"));
		return undefined;
	}
	rejectUnknown(input, COMPONENT_KEYS, path, errors);
	const name = typeof input.name === "string" ? input.name : "";
	if (!COMPONENT_NAME.test(name)) {
		errors.push(issue(`${path}.name`, "must be a PascalCase catalog name"));
	}
	if (input.id !== name) {
		errors.push(issue(`${path}.id`, "must be the catalog component name"));
	}
	if (!COMPONENT_NAME.test(name) || input.id !== name) return undefined;
	return { id: name, name };
}

function readAdapter(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): ManifestAdapter | undefined {
	if (
		typeof input !== "string" ||
		!ADAPTERS.includes(input as ManifestAdapter)
	) {
		errors.push(issue(path, "must be xstate, redux, mobx, or actor-web"));
		return undefined;
	}
	return input as ManifestAdapter;
}

function readIdentifier(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): string | undefined {
	if (typeof input !== "string" || !IDENTIFIER.test(input)) {
		errors.push(issue(path, "must be a lowercase identifier"));
		return undefined;
	}
	return input;
}

function readStringList(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): string[] | undefined {
	if (!Array.isArray(input)) {
		errors.push(issue(path, "must be an array"));
		return undefined;
	}
	const values: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < input.length; index += 1) {
		const value = input[index];
		if (!isNonEmptyString(value)) {
			errors.push(issue(`${path}[${index}]`, "must be a non-empty string"));
			continue;
		}
		if (seen.has(value)) {
			errors.push(issue(`${path}[${index}]`, `duplicate "${value}"`));
		}
		seen.add(value);
		values.push(value);
	}
	return values;
}

function readIdentifierList(
	input: unknown,
	path: string,
	errors: ManifestIssue[],
): string[] | undefined {
	const values = readStringList(input, path, errors);
	if (!values) return undefined;
	for (let index = 0; index < values.length; index += 1) {
		if (!IDENTIFIER.test(values[index] ?? "")) {
			errors.push(issue(`${path}[${index}]`, "must be a lowercase identifier"));
		}
	}
	return values;
}

function rejectUnknown(
	input: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ManifestIssue[],
): void {
	for (const key of Object.keys(input)) {
		if (!allowed.includes(key)) {
			const at = path ? `${path}.${key}` : key;
			errors.push(issue(at, "is not a manifest field"));
		}
	}
}

function isFlagKind(value: unknown): value is ManifestFlagKind {
	return (
		typeof value === "string" && FLAG_KINDS.includes(value as ManifestFlagKind)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function issue(path: string, message: string): ManifestIssue {
	return { path, message };
}
