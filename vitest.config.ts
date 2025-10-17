import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: "jsdom",
			include: ["src/**/*.test.ts"],
			setupFiles: "./vitest.setup.ts",
			coverage: {
				exclude: [
					"src/examples/**",
					"**/*.config.{js,ts}",
					"vite.config.ts",
					"vitest.config.ts",
					"vite-env.d.ts",
					"dist/**",
					"src/index.ts",
					"src/**/*.d.ts",
					"scripts",
					"commitlint.config.cjs",
				],
			},
		},
	}),
);
