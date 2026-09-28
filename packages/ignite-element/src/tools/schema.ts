import type { ToolSchema } from "./types";

/**
 * Identity factory that preserves literal command names and `gated` flags
 * on an explicit `ToolSchema`. Use with named
 * `igniteTools({ core, schema, canExecute?, dialect? })`.
 */
export function defineToolSchema<const S extends ToolSchema>(schema: S): S {
	return schema;
}
