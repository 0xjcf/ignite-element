import { applySchemaDefaults, snapshotPlainJson } from "./plainJson";
import { err, ok, type Result } from "./result";
import {
	isNoArgSchema,
	isPlainObject,
	validateToolInputValue,
} from "./toolInput";
import type {
	AvailabilityPredicate,
	NeutralManifest,
	NeutralTool,
	Route,
	ToolCommandSchema,
	ToolError,
	ToolInputSchema,
	ToolSchema,
} from "./types";

const TOOL_INPUT_TYPES = new Set([
	"number",
	"string",
	"boolean",
	"object",
	"array",
]);

function unsupportedInputTypeError(type: unknown, path: string): Error {
	return new Error(
		`[igniteTools] Unsupported input schema type ${JSON.stringify(type)} at ${path}. Supported types: number, string, boolean, object, array.`,
	);
}

function assertSupportedInputSchema(
	schema: ToolInputSchema,
	path: string,
): void {
	if (!isPlainObject(schema)) {
		throw new Error(
			`[igniteTools] Missing explicit command input schema at ${path}. Supply tool/application definitions; discovery does not infer schemas.`,
		);
	}
	if ("type" in schema && schema.type !== undefined) {
		if (!TOOL_INPUT_TYPES.has(schema.type)) {
			throw unsupportedInputTypeError(schema.type, path);
		}
	}
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	for (const [key, property] of Object.entries(properties)) {
		if (isPlainObject(property)) {
			assertSupportedInputSchema(property, `${path}.properties.${key}`);
		}
	}
	if (isPlainObject(schema.items)) {
		assertSupportedInputSchema(schema.items, `${path}.items`);
	}
}

/** Reject unknown `type` strings before a schema is offered as tools. */
export function assertSupportedToolSchema(schema: ToolSchema): void {
	if (!isPlainObject(schema)) {
		throw new Error(
			"[igniteTools] Unknown command catalogue. Supply explicit tool definitions.",
		);
	}
	for (const name of Object.keys(schema)) {
		const metadata = schema[name];
		if (!isPlainObject(metadata)) {
			throw new Error(
				`[igniteTools] Missing explicit command input schema at ${name}. Supply tool/application definitions; discovery does not infer schemas.`,
			);
		}
		assertSupportedInputSchema(metadata.input, `${name}.input`);
	}
}

// Explicit application input schema, scalar or object, mirrored verbatim.
// Unknown discovery metadata must not fabricate an empty-object contract.
function toInputSchema(metadata: ToolCommandSchema): ToolInputSchema {
	if (!isPlainObject(metadata)) {
		throw new Error(
			"[igniteTools] Missing explicit command input schema. Supply tool/application definitions; discovery does not infer schemas.",
		);
	}
	const input = metadata.input;
	if (!isPlainObject(input)) {
		throw new Error(
			"[igniteTools] Missing explicit command input schema. Supply tool/application definitions; discovery does not infer schemas.",
		);
	}
	assertSupportedInputSchema(input, "input");
	return input;
}

/**
 * Advanced/testing helper. Everyday apps should bind with
 * `igniteTools({ core, schema, canExecute?, dialect? })` instead of importing
 * this.
 *
 * Pure: explicit application schema → neutral tool manifest, sorted by name.
 * Gated commands are omitted when an availability predicate reports them
 * currently unavailable. Without a predicate, commands are denied. An ungated
 * `read: true` tool stays available only when that command is side-effect-free.
 *
 * Only the bare command map is read. Minimal core discovery does not provide
 * input validation; missing explicit definitions fail before execution.
 */
function isSideEffectFreeRead(tool: {
	read?: boolean;
	gated?: boolean;
	consequential?: boolean;
}): boolean {
	return (
		tool.read === true && tool.consequential !== true && tool.gated !== true
	);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as PromiseLike<unknown>).then === "function"
	);
}

function predicateAllows(
	canExecute: AvailabilityPredicate | undefined,
	name: string,
	call?: {
		input: unknown;
		context?: { readonly core: object; readonly execute?: boolean };
	},
): boolean {
	if (typeof canExecute !== "function") return false;
	try {
		const result = call
			? canExecute(name, call.input, call.context)
			: canExecute(name);
		if (isThenable(result)) {
			void Promise.resolve(result).catch(() => undefined);
			return false;
		}
		return result === true;
	} catch {
		return false;
	}
}

function allowsTool(
	tool: { read?: boolean; gated?: boolean; consequential?: boolean },
	name: string,
	canExecute?: AvailabilityPredicate,
	call?: {
		input: unknown;
		context?: { readonly core: object; readonly execute?: boolean };
	},
): boolean {
	if (isSideEffectFreeRead(tool)) return true;
	return predicateAllows(canExecute, name, call);
}

export function buildManifest(
	schema: ToolSchema,
	canExecute?: AvailabilityPredicate,
): NeutralManifest {
	if (!isPlainObject(schema)) {
		throw new Error(
			"[igniteTools] Unknown command catalogue. Supply explicit tool definitions.",
		);
	}
	assertSupportedToolSchema(schema);
	const manifest: NeutralManifest = [];

	for (const name of Object.keys(schema).sort()) {
		const metadata = schema[name];
		const consequential = metadata.consequential === true;
		const read = metadata.read === true && !consequential;
		const gated = metadata.gated === true;
		if (!allowsTool({ read, gated, consequential }, name, canExecute)) {
			continue;
		}

		const tool: NeutralTool = {
			name,
			inputSchema: toInputSchema(metadata),
			gated,
			read,
			consequential,
		};
		if (typeof metadata.description === "string") {
			tool.description = metadata.description;
		}
		manifest.push(tool);
	}

	return manifest;
}

/** Copy every own property except `default`, without reading that getter. */
function schemaWithoutOwnDefault(schema: ToolInputSchema): ToolInputSchema {
	const copy: ToolInputSchema = {};
	for (const key of Reflect.ownKeys(schema)) {
		if (key === "default") continue;
		const descriptor = Object.getOwnPropertyDescriptor(schema, key);
		if (descriptor) Object.defineProperty(copy, key, descriptor);
	}
	return copy;
}

/**
 * Advanced/testing helper. Everyday apps should call `run` on a named
 * `igniteTools({ core, schema })` bind instead of importing this.
 *
 * Pure: read a schema default once, copy one detached plain-JSON snapshot of
 * that materialized value, then validate that copy. `canExecute(name, input,
 * context)` and the returned route share that frozen snapshot. A later read of
 * the same default is not validated and is not routed. Only finite numbers
 * (with `-0` normalized to `0`), strings, booleans, null, arrays, and plain
 * objects are copied.
 * Accessors, bigint, symbols, functions, `Date` / `Map` / `Set`, cycles, and
 * values past the nesting limit are `InvalidInput`. Signed zero is collapsed
 * to `0` on purpose. A proxy is walked once (`ownKeys`, then one data
 * descriptor per key) and that copy is what is validated. Array length comes
 * from that descriptor or the copied indexes, never from `[[Get]]` of
 * `length`. This function
 * forwards `context` and does not set `execute`. `run` calls it without
 * `execute`, then calls `canExecute` with `{ execute: true }` only after
 * observation is subscribed and immediately before `core.execute`. A throw
 * while reading the input is `InvalidInput`, never an exception. `UnknownCommand`
 * means the name is not in the manifest. `Unavailable` means the predicate is
 * missing, throws, returns a thenable, or returns anything other than true.
 */
export function resolveCall(
	manifest: NeutralManifest,
	name: string,
	input: unknown,
	canExecute?: AvailabilityPredicate,
	context?: { readonly core: object; readonly execute?: boolean },
): Result<Route, ToolError> {
	const tool = manifest.find((candidate) => candidate.name === name);
	if (!tool) {
		return err({ kind: "UnknownCommand", name });
	}

	let route: Route;
	try {
		const source = applySchemaDefaults(tool.inputSchema, input);
		if (!source.ok) {
			return err({ kind: "InvalidInput", name, issues: source.issues });
		}
		const noArg = isNoArgSchema(tool.inputSchema);
		// applySchemaDefaults already read a top-level default. Keep that value
		// for the snapshot, the validation, and the route. Stripping `default`
		// when the read was undefined stops a later getter value from being
		// validated in its place.
		const defaultMaterialized =
			input === undefined && !noArg && "default" in tool.inputSchema;
		if (source.value === undefined) {
			const issues = validateToolInputValue(
				defaultMaterialized
					? schemaWithoutOwnDefault(tool.inputSchema)
					: tool.inputSchema,
				undefined,
				"input",
			);
			if (issues.length > 0) {
				return err({ kind: "InvalidInput", name, issues });
			}
			// An omitted optional object stays omitted. A no-arg command with no
			// caller value drops the input field. Neither one is a JSON value
			// to snapshot.
			route = noArg ? { command: name } : { command: name, input: undefined };
		} else {
			const snapshot = snapshotPlainJson(
				source.value,
				"input",
				tool.inputSchema,
			);
			if (!snapshot.ok) {
				return err({ kind: "InvalidInput", name, issues: snapshot.issues });
			}
			const issues = validateToolInputValue(
				tool.inputSchema,
				snapshot.value,
				"input",
			);
			if (issues.length > 0) {
				return err({ kind: "InvalidInput", name, issues });
			}
			// The snapshot that passed validation is the routed input, including
			// provider {} on a no-arg command. canExecute and execute share it.
			route = { command: name, input: snapshot.value };
		}
	} catch {
		return err({
			kind: "InvalidInput",
			name,
			issues: ["input: unable to read value"],
		});
	}
	if (
		!allowsTool(tool, name, canExecute, {
			input: route.input,
			context,
		})
	) {
		return err({ kind: "Unavailable", name });
	}

	return ok(route);
}
