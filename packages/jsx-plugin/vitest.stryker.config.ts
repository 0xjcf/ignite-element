import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
	...baseConfig,
	root: fileURLToPath(new URL(".", import.meta.url)),
	test: {
		...baseConfig.test,
		include: [
			"src/transform.test.ts",
			"src/review-findings.test.ts",
			"src/pr180-regressions.test.ts",
			"src/compiler-entrypoints.test.ts",
			"src/compiler-style-properties.test.ts",
			"src/beta-followups.test.ts",
			"src/guard-corrections.property.test.ts",
			"src/guard-boundaries.property.test.ts",
			"src/guard-review-followups.property.test.ts",
			"src/guard-ordinary-members.property.test.ts",
		],
		execArgv: [],
	},
});
