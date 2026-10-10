import { assertSupportedToolSchema } from "./core";
import type { ToolSchema } from "./types";

/**
 * Identity factory that preserves literal command names and `gated`, `read`,
 * and `consequential` flags on a bare command-map `ToolSchema`. Use with named
 * `igniteTools({ core, schema, canExecute?, actor?, dialect? })`.
 * Unknown `input.type` strings are rejected at construction.
 */
export function defineToolSchema<const S extends ToolSchema>(schema: S): S {
	assertSupportedToolSchema(schema);
	return schema;
}
