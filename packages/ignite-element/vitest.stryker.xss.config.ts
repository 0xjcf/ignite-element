import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.stryker.config";

// Mutation run for the JSX XSS guard only. The full renderer file stays on
// the daily Stryker config.
export default defineConfig(async (configEnv) => {
	const resolved =
		typeof baseConfig === "function" ? await baseConfig(configEnv) : baseConfig;
	return {
		...resolved,
		test: {
			...resolved.test,
			include: [
				"src/tests/renderers/cssSeparatorProperties.test.ts",
				"src/tests/renderers/jsxXss.test.ts",
				"src/tests/renderers/authorStyleGold.test.ts",
				"src/tests/renderers/rendererMutation.test.ts",
			],
		},
	};
});
