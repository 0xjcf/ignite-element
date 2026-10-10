/**
 * Source executed by Vitest and the examples is not the published build.
 * Those runners replace this identifier so the import does not throw.
 * Library production builds set it to false and compile the warnings out.
 */
export const igniteDevWarningsDefine = {
	__IGNITE_DEV_WARNINGS__: "true",
} as const;
