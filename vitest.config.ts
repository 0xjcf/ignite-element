import { defineConfig, mergeConfig } from "vitest/config";
import config from "./packages/ignite-element/vitest.config";

export default mergeConfig(
	config,
	defineConfig({
		root: ".",
		test: {
			environment: "jsdom",
			setupFiles: "packages/ignite-element/vitest.setup.ts",
			include: [
				"packages/ignite-element/src/**/*.test.ts",
				"packages/ignite-element/src/**/*.test.tsx",
			],
		},
	}),
);
