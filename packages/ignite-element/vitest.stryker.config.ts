import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Stryker's vitest runner forces `pool: "threads"`, and worker threads reject
// `--expose-gc` in `execArgv` (ERR_WORKER_INVALID_EXEC_ARGV), which makes the
// initial test run hang. `mergeConfig` concatenates arrays, so clear the flag
// on the resolved config instead. The mutation workflow exposes gc to every
// worker through NODE_OPTIONS.
export default defineConfig(async (configEnv) => {
	const resolved =
		typeof baseConfig === "function" ? await baseConfig(configEnv) : baseConfig;
	return {
		...resolved,
		// Stryker runs from the sandbox root; pin the project root so the relative
		// `include` and `setupFiles` globs resolve inside this package.
		root: fileURLToPath(new URL(".", import.meta.url)),
		test: { ...resolved.test, execArgv: [] },
	};
});
