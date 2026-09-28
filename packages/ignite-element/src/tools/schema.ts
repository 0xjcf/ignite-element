import type { ToolSchema } from "./types";

/**
 * Preserve literal command names and `gated: true` so a named
 * `igniteTools({ core, schema })` bind can type-check availability.
 */
export function defineToolSchema<const S extends ToolSchema>(schema: S): S {
	return schema;
}
