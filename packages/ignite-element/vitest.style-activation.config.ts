import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.stryker.config";

// These properties reload modules to exercise an uninitialized style slot.
// The focused Stryker profile runs this command in a fresh process per mutant
// so the active mutant is present before each module's initialization.
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
				"src/tests/style-activation.property.test.ts",
				"src/tests/injectStyles.test.ts",
				"src/tests/globalStyles.test.ts",
			],
		},
	};
});
