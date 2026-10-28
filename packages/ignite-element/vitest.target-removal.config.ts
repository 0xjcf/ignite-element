import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.stryker.config";

// Focused migration profile; does not change the nightly renderer profile.
export default defineConfig(async (environment) => {
	const base =
		typeof baseConfig === "function"
			? await baseConfig(environment)
			: baseConfig;
	return {
		...base,
		test: {
			...base.test,
			include: [
				"src/tests/target-removal.test.ts",
				"../../examples/agents/voice-workbench/src/artifact*.test.ts",
			],
		},
	};
});
