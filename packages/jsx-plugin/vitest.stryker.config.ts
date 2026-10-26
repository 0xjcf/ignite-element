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
		],
		execArgv: [],
	},
});
